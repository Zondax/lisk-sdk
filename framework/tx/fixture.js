const fs = require('fs');
const path = require('path');
const { codec } = require('@liskhq/lisk-codec');
const fixture = require('./samples.json');
const { Application } = require('../dist-node');
const { transactionSchema, TAG_TRANSACTION } = require('@liskhq/lisk-chain');
const {
	crossChainUpdateTransactionParams,
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
	const com = mod.commands.find(c => c.name === command);
	if (!com) {
		throw new Error(`${command} not found in metadata`);
	}
	return com.params;
};

const insertInteropsCommands = metadata => {
	const mod = metadata.find(meta => meta.name === 'interoperability');
	if (!mod) {
		throw new Error(`${module} not found in metadata`);
	}
	mod.commands = [
		{
			name: 'mainchainCCUpdate',
			params: crossChainUpdateTransactionParams,
		},
		{
			name: 'sidechainCCUpdate',
			params: crossChainUpdateTransactionParams,
		},
		{
			name: 'mainchainRegistration',
			params: mainchainRegParams,
		},
		{
			name: 'sidechainRegistration',
			params: sidechainRegParams,
		},
		{
			name: 'stateRecovery',
			params: stateRecoveryParamsSchema,
		},
		{
			name: 'stateRecoveryInitialization',
			params: stateRecoveryInitParams,
		},
		{
			name: 'messageRecovery',
			params: messageRecoveryParamsSchema,
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

const formatOutput = (index, title, value) => `${index} | ${title} : ${value}`;

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
		result.push({
			index: result.length,
			name: `${input.unsignedTransaction.module}_${input.unsignedTransaction.command}`,
			blob: encodedTx.toString('hex'),
			output: input.summaryKeys.map((k, i) => {
				const { name, value } = getNested(input.unsignedTransaction, k);
				return formatOutput(i, name, value);
			}),
			output_expert: input.detailKeys.map((k, i) => {
				const { name, value } = getNested(input.unsignedTransaction, k);
				return formatOutput(i, name, value);
			}),
			signature: signature.toString('hex'),
		});
	}

	fs.writeFileSync(
		path.join(__dirname, './fixture.json'),
		JSON.stringify({ data: result }, undefined, '  '),
	);
})();
