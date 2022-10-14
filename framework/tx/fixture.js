const fs = require('fs');
const path = require('path');
const { codec } = require('@liskhq/lisk-codec');
const { convertBeddowsToLSK } = require('@liskhq/lisk-transactions');
const fixture = require('./tx_samples_big.json');
const { Application } = require('../dist-node');
const { transactionSchema, TAG_TRANSACTION } = require('@liskhq/lisk-chain');
const {
	mainchainRegParams,
	sidechainRegParams,
	stateRecoveryParamsSchema,
	stateRecoveryInitParams,
	messageRecoveryParamsSchema,
} = require('../dist-node/modules/interoperability/schemas');
const { ed } = require('@liskhq/lisk-cryptography');

const getParamsSchema = (metadata, module, command) => {
	const mod = metadata.find(meta => meta.name === module);
	if (!mod) {
		throw new Error(`${module} not found in metadata`);
	}
	const com = mod.commands.find(c => mapName(c.name) === command);
	if (!com) {
		throw new Error(`${command} not found in metadata`);
	}
	return com.params;
};

const crossChainUpdateTransactionParams = {
	$id: '/modules/interoperability/ccu',
	type: 'object',
	required: [
		'sendingChainID',
		'certificate',
		'activeValidatorsUpdate',
		'certificateThreshold',
		'inboxUpdate',
	],
	properties: {
		sendingChainID: {
			dataType: 'bytes',
			fieldNumber: 1,
		},
		certificate: {
			dataType: 'bytes',
			fieldNumber: 2,
		},
		activeValidatorsUpdate: {
			type: 'array',
			fieldNumber: 3,
			items: {
				type: 'object',
				required: ['blsKey', 'bftWeight'],
				properties: {
					blsKey: {
						dataType: 'bytes',
						fieldNumber: 1,
					},
					bftWeight: {
						dataType: 'uint64',
						fieldNumber: 2,
					},
				},
			},
		},
		certificateThreshold: {
			dataType: 'uint64',
			fieldNumber: 4,
		},
		inboxUpdate: {
			type: 'object',
			fieldNumber: 5,
			required: ['crossChainMessages', 'messageWitnessHashes', 'outboxRootWitness'],
			properties: {
				crossChainMessages: {
					type: 'array',
					fieldNumber: 1,
					items: { dataType: 'bytes' },
				},
				messageWitnessHashes: {
					type: 'array',
					fieldNumber: 2,
					items: { dataType: 'bytes' },
				},
				outboxRootWitness: {
					type: 'object',
					fieldNumber: 3,
					required: ['bitmap', 'siblingHashes'],
					properties: {
						bitmap: {
							dataType: 'bytes',
							fieldNumber: 1,
						},
						siblingHashes: {
							type: 'array',
							fieldNumber: 2,
							items: { dataType: 'bytes' },
						},
					},
				},
			},
		},
	},
};

const insertInteropsCommands = metadata => {
	const mod = metadata.find(meta => meta.name === 'interoperability');
	if (!mod) {
		throw new Error(`${module} not found in metadata`);
	}
	mod.commands = [
		{
			name: 'submitMainchainCrossChainUpdate',
			params: crossChainUpdateTransactionParams,
		},
		{
			name: 'submitSidechainCrossChainUpdate',
			params: crossChainUpdateTransactionParams,
		},
		{
			name: 'registerMainchain',
			params: mainchainRegParams,
		},
		{
			name: 'registerSidechain',
			params: sidechainRegParams,
		},
		{
			name: 'recoverState',
			params: stateRecoveryParamsSchema,
		},
		{
			name: 'initializeStateRecovery',
			params: stateRecoveryInitParams,
		},
		{
			name: 'recoverMessage',
			params: messageRecoveryParamsSchema,
		},
		{
			name: 'initializeMessageRecovery',
			params: {
				$id: 'lisk/interoperability/messageRecoveryInitialization',
				type: 'object',
				required: ['chainID', 'channel', 'bitmap', 'siblingHashes'],
				properties: {
					chainID: {
						dataType: 'bytes',
						fieldNumber: 1,
					},
					channel: {
						dataType: 'bytes',
						fieldNumber: 2,
					},
					bitmap: {
						dataType: 'bytes',
						fieldNumber: 3,
					},
					siblingHashes: {
						type: 'array',
						items: {
							dataType: 'bytes',
						},
						fieldNumber: 4,
					},
				},
			},
		},
	];
};

const insertLegacyCommands = metadata => {
	metadata.push({
		name: 'legacy',
		commands: [
			{
				name: 'reclaimLSK',
				params: {
					$id: 'lisk/legacy/reclaimLSK',
					type: 'object',
					required: ['amount'],
					properties: {
						amount: {
							dataType: 'uint64',
							fieldNumber: 1,
						},
					},
				},
			},
			{
				name: 'registerKeys',
				params: {
					$id: 'lisk/legacy/registerKeys',
					type: 'object',
					required: ['blsKey', 'proofOfPossession', 'generatorKey'],
					properties: {
						blsKey: {
							dataType: 'bytes',
							fieldNumber: 1,
						},
						proofOfPossession: {
							dataType: 'bytes',
							fieldNumber: 2,
						},
						generatorKey: {
							dataType: 'bytes',
							fieldNumber: 3,
						},
					},
				},
			},
		],
	});
};

const splitInScreens = value => {
	const PAGE_LENGTH = 38;
	const amountPages = Math.ceil(value.length / PAGE_LENGTH);
	if (amountPages === 1) return [`: ${value}`];
	const returnValue = [];
	for (let i = 0; i < amountPages; i++) {
		const finalValue = value.slice(i * PAGE_LENGTH, (i + 1) * PAGE_LENGTH);
		returnValue.push(`[${i + 1}/${amountPages}] : ${finalValue}`);
	}
	return returnValue;
};

const formatOutput = (index, title, value) => {
	if (!Array.isArray(value)) {
		const returnValue = [];
		const splitVal = splitInScreens(formatLSK(title, value));
		splitVal.forEach(x => {
			returnValue.push(`${index} | ${capitalAndShort(title)} ${x}`);
		});
		return returnValue;
	}

	const returnValue = [];
	value.forEach((val, idx) => {
		if (title === 'votes') {
			splitInScreens(val.delegateAddress).forEach(x => {
				returnValue.push(`${index + 2 * idx} | ${capitalAndShort(title)} ${idx} ${x}`);
			});
			splitInScreens(formatLSK('amount', val.amount)).forEach(x => {
				returnValue.push(`${index + 2 * idx + 1} | ${capitalAndShort(title)} ${idx} ${x}`);
			});
		} else {
			splitInScreens(val).forEach(x => {
				returnValue.push(`${index + idx} | ${capitalAndShort(title)} ${idx} ${x}`);
			});
		}
	});
	return returnValue;
};

const capitalAndShort = title => {
	const translate = {
		recipientAddress: 'rxAddress',
		accountInitializationFee: 'acntInitFee',
		receivingChainID: 'rxChainID',
		escrowInitializationFee: 'escrowInitFee',
		messageFee: 'msgFee',
		numberOfSignatures: 'nSignatures',
		mandatoryKeys: 'key',
		optionalKeys: 'optKey',
		signatures: 'sign',
		generatorKey: 'genKey',
		proofOfPossession: 'poP',
	};
	const remap = translate[title] ?? title;
	return remap.charAt(0).toUpperCase() + remap.slice(1);
};

const formatLSK = (title, value) => {
	if (!['amount', 'fee'].includes(title)) {
		return Array.isArray(value) ? value : String(value);
	}
	const lsk = convertBeddowsToLSK(value);

	return `LSK ${lsk}`;
};

const mapName = original => {
	switch (original) {
		case 'crossChainTransfer':
			return 'transferCrossChain';
		case 'voteDelegate':
			return 'vote';
		case 'registerMultisignatureGroup':
			return 'registerMultisignature';
		case 'reportDelegateMisbehavior':
			return 'reportMisbehavior';
		default:
			return original;
	}
};

const getNested = (obj, key) => {
	const splitKeys = key.split('.');
	let value = obj;
	for (const sk of splitKeys) {
		value = value[sk];
	}

	return {
		name: splitKeys[splitKeys.length - 1],
		value,
	};
};

(async () => {
	const { app } = Application.defaultApplication();
	const privateKey = Buffer.from(fixture.privateKey, 'hex');
	const metadata = app.getMetadata();
	console.log(JSON.stringify(metadata, undefined, '  '));
	insertInteropsCommands(metadata);
	insertLegacyCommands(metadata);
	const result = [];
	for (const input of fixture.data) {
		console.log('processing', input.unsignedTransaction.module, input.unsignedTransaction.command);
		const paramsSchema = getParamsSchema(
			metadata,
			input.unsignedTransaction.module,
			input.unsignedTransaction.command,
		);
		const encodedParams =
			Object.keys(input.unsignedTransaction.params).length > 0
				? codec.encodeJSON(paramsSchema, input.unsignedTransaction.params)
				: Buffer.alloc(0);
		const unsignedTx = {
			...input.unsignedTransaction,
			params: encodedParams.toString('hex'),
		};
		const encodedTx = codec.encodeJSON(transactionSchema, unsignedTx);
		const signature = ed.signDataWithPrivateKey(
			TAG_TRANSACTION,
			Buffer.from(fixture.chainID, 'hex'),
			encodedTx,
			privateKey,
		);
		const signedTx = {
			...unsignedTx,
			signatures: [signature.toString('hex')],
		};
		const createOutput = keys => {
			const returnValue = [];
			let extraScreens = 0;
			keys.forEach((k, i) => {
				const { name, value } = getNested(input.unsignedTransaction, k);
				returnValue.push(...formatOutput(extraScreens + i, name, value));
				if (Array.isArray(value)) extraScreens += value.length - 1;
			});
			return returnValue;
		};

		result.push({
			index: result.length,
			name: `${input.unsignedTransaction.module}_${input.unsignedTransaction.command}`,
			blob: encodedTx.toString('hex'),
			output: createOutput(input.summaryKeys),
			output_expert: createOutput(input.detailKeys),
			signature: signature.toString('hex'),
		});
	}

	fs.writeFileSync(
		path.join(__dirname, './fixture.json'),
		JSON.stringify({ data: result }, undefined, '  '),
	);
})();
