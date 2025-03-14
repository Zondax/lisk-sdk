/*
 * Copyright © 2022 Lisk Foundation
 *
 * See the LICENSE file at the top-level directory of this distribution
 * for licensing information.
 *
 * Unless otherwise agreed in a custom licensing agreement with the Lisk Foundation,
 * no part of this software, including this file, may be copied, modified,
 * propagated, or distributed except according to the terms contained in the
 * LICENSE file.
 *
 * Removal or modification of this copyright notice is prohibited.
 */

import { codec } from '@liskhq/lisk-codec';
import { utils } from '@liskhq/lisk-cryptography';
import { SidechainCCRegistrationCommand } from '../../../../../../src/modules/interoperability/sidechain/cc_commands/registration';
import { registrationCCMParamsSchema } from '../../../../../../src/modules/interoperability/schemas';
import { SidechainInteroperabilityStore } from '../../../../../../src/modules/interoperability/sidechain/store';
import { CCCommandExecuteContext } from '../../../../../../src/modules/interoperability/types';
import { createExecuteCCMsgMethodContext } from '../../../../../../src/testing';
import { SidechainInteroperabilityModule } from '../../../../../../src';
import {
	CROSS_CHAIN_COMMAND_NAME_REGISTRATION,
	MODULE_NAME_INTEROPERABILITY,
} from '../../../../../../src/modules/interoperability/constants';

describe('SidechainCCRegistrationCommand', () => {
	const interopMod = new SidechainInteroperabilityModule();

	const terminateChainInternalMock = jest.fn();
	const getChannelMock = jest.fn();
	const getOwnChainAccountMock = jest.fn();

	const ownChainAccount = {
		name: 'sidechain',
		id: utils.intToBuffer(1, 4),
		nonce: BigInt(0),
	};

	const ccMethodMod1 = {
		beforeSendCCM: jest.fn(),
		beforeApplyCCM: jest.fn(),
	};

	const ccMethodMod2 = {
		beforeSendCCM: jest.fn(),
		beforeApplyCCM: jest.fn(),
	};

	const ccMethodsMap = new Map();
	ccMethodsMap.set(1, ccMethodMod1);
	ccMethodsMap.set(2, ccMethodMod2);

	const chainID = utils.getRandomBytes(32);

	const ccmRegistrationParams = {
		chainID,
		name: ownChainAccount.name,
		messageFeeTokenID: {
			chainID: utils.intToBuffer(1, 4),
			localID: utils.intToBuffer(0, 4),
		},
	};

	const encodedRegistrationParams = codec.encode(
		registrationCCMParamsSchema,
		ccmRegistrationParams,
	);

	const ccm = {
		nonce: BigInt(0),
		module: MODULE_NAME_INTEROPERABILITY,
		crossChainCommand: CROSS_CHAIN_COMMAND_NAME_REGISTRATION,
		sendingChainID: utils.intToBuffer(2, 4),
		receivingChainID: utils.intToBuffer(1, 4),
		fee: BigInt(20000),
		status: 0,
		params: encodedRegistrationParams,
	};
	const channelData = {
		inbox: {
			appendPath: [],
			root: Buffer.alloc(0),
			size: 1,
		},
		messageFeeTokenID: {
			chainID: utils.intToBuffer(1, 4),
			localID: utils.intToBuffer(0, 4),
		},
		outbox: {
			appendPath: [],
			root: Buffer.alloc(0),
			size: 1,
		},
		partnerChainOutboxRoot: Buffer.alloc(0),
	};
	const sampleExecuteContext: CCCommandExecuteContext = createExecuteCCMsgMethodContext({
		ccm,
		chainID,
	});

	let sidechainInteroperabilityStore: SidechainInteroperabilityStore;
	let ccRegistrationCommand: SidechainCCRegistrationCommand;

	beforeEach(() => {
		sidechainInteroperabilityStore = new SidechainInteroperabilityStore(
			interopMod.stores,
			sampleExecuteContext,
			ccMethodsMap,
		);
		sidechainInteroperabilityStore.terminateChainInternal = terminateChainInternalMock;
		sidechainInteroperabilityStore.getChannel = getChannelMock;
		sidechainInteroperabilityStore.getOwnChainAccount = getOwnChainAccountMock;

		ccRegistrationCommand = new SidechainCCRegistrationCommand(
			interopMod.stores,
			interopMod.events,
			ccMethodsMap,
		);
		(ccRegistrationCommand as any)['getInteroperabilityStore'] = jest
			.fn()
			.mockReturnValue(sidechainInteroperabilityStore);
	});

	it('should call terminateChainInternal when sendingChainChannelAccount.inbox.size !== 1', async () => {
		// Arrange
		const dataWithMoreThanOneInboxSize = {
			inbox: {
				appendPath: [],
				root: Buffer.alloc(0),
				size: 2,
			},
			messageFeeTokenID: {
				chainID: utils.intToBuffer(1, 4),
				localID: utils.intToBuffer(0, 4),
			},
			outbox: {
				appendPath: [],
				root: Buffer.alloc(0),
				size: 1,
			},
			partnerChainOutboxRoot: Buffer.alloc(0),
		};

		getChannelMock.mockResolvedValue(dataWithMoreThanOneInboxSize);

		getOwnChainAccountMock.mockResolvedValue(ownChainAccount);

		await ccRegistrationCommand.execute(sampleExecuteContext);

		expect(terminateChainInternalMock).toHaveBeenCalledTimes(1);
		expect(terminateChainInternalMock).toHaveBeenCalledWith(
			ccm.sendingChainID,
			expect.objectContaining({
				chainID,
				ccm,
			}),
		);
	});

	it('should call terminateChainInternal when ccm.status !== CCM_STATUS_OK', async () => {
		// Arrange
		const invalidCCM = {
			nonce: BigInt(0),
			module: MODULE_NAME_INTEROPERABILITY,
			crossChainCommand: CROSS_CHAIN_COMMAND_NAME_REGISTRATION,
			sendingChainID: utils.intToBuffer(2, 4),
			receivingChainID: utils.intToBuffer(1, 4),
			fee: BigInt(20000),
			status: 1,
			params: encodedRegistrationParams,
		};

		getOwnChainAccountMock.mockResolvedValue(ownChainAccount);

		await ccRegistrationCommand.execute({ ...sampleExecuteContext, ccm: invalidCCM });

		expect(terminateChainInternalMock).toHaveBeenCalledTimes(1);
		expect(terminateChainInternalMock).toHaveBeenCalledWith(
			ccm.sendingChainID,
			expect.objectContaining({
				chainID,
				ccm: invalidCCM,
			}),
		);
	});

	it('should call terminateChainInternal when ownChainAccount.id !== ccm.receivingChainID', async () => {
		// Arrange
		getChannelMock.mockResolvedValue(channelData);

		getOwnChainAccountMock.mockResolvedValue({ ...ownChainAccount, id: utils.intToBuffer(3, 4) });

		await ccRegistrationCommand.execute(sampleExecuteContext);

		expect(terminateChainInternalMock).toHaveBeenCalledTimes(1);
		expect(terminateChainInternalMock).toHaveBeenCalledWith(
			ccm.sendingChainID,
			expect.objectContaining({
				chainID,
				ccm,
			}),
		);
	});

	it('should call terminateChainInternal when ownChainAccount.name !== decodedParams.name', async () => {
		// Arrange
		getChannelMock.mockResolvedValue(channelData);

		getOwnChainAccountMock.mockResolvedValue({ ...ownChainAccount, name: 'chain1' });

		await ccRegistrationCommand.execute(sampleExecuteContext);

		expect(terminateChainInternalMock).toHaveBeenCalledTimes(1);
		expect(terminateChainInternalMock).toHaveBeenCalledWith(
			ccm.sendingChainID,
			expect.objectContaining({
				chainID,
				ccm,
			}),
		);
	});

	it('should call terminateChainInternal when sendingChainChannelAccount.chainID !== decodedParams.chainID', async () => {
		// Arrange
		const incorrectChainIDChannelData = {
			inbox: {
				appendPath: [],
				root: Buffer.alloc(0),
				size: 2,
			},
			messageFeeTokenID: {
				chainID: utils.intToBuffer(3, 4),
				localID: utils.intToBuffer(0, 4),
			},
			outbox: {
				appendPath: [],
				root: Buffer.alloc(0),
				size: 1,
			},
			partnerChainOutboxRoot: Buffer.alloc(0),
		};
		getChannelMock.mockResolvedValue(incorrectChainIDChannelData);

		getOwnChainAccountMock.mockResolvedValue(ownChainAccount);

		await ccRegistrationCommand.execute(sampleExecuteContext);

		expect(terminateChainInternalMock).toHaveBeenCalledTimes(1);
		expect(terminateChainInternalMock).toHaveBeenCalledWith(
			ccm.sendingChainID,
			expect.objectContaining({
				chainID,
				ccm,
			}),
		);
	});

	it('should call terminateChainInternal when sendingChainChannelAccount.localID !== decodedParams.localID', async () => {
		// Arrange
		const incorrectChainIDChannelData = {
			inbox: {
				appendPath: [],
				root: Buffer.alloc(0),
				size: 2,
			},
			messageFeeTokenID: {
				chainID: utils.intToBuffer(1, 4),
				localID: utils.intToBuffer(5, 4),
			},
			outbox: {
				appendPath: [],
				root: Buffer.alloc(0),
				size: 1,
			},
			partnerChainOutboxRoot: Buffer.alloc(0),
		};
		getChannelMock.mockResolvedValue(incorrectChainIDChannelData);

		getOwnChainAccountMock.mockResolvedValue(ownChainAccount);

		await ccRegistrationCommand.execute(sampleExecuteContext);

		expect(terminateChainInternalMock).toHaveBeenCalledTimes(1);
		expect(terminateChainInternalMock).toHaveBeenCalledWith(
			ccm.sendingChainID,
			expect.objectContaining({
				chainID,
				ccm,
			}),
		);
	});

	it('should call terminateChainInternal when decodedParams.chainID !== ownChainAccount.chainID', async () => {
		// Arrange
		getChannelMock.mockResolvedValue(channelData);

		getOwnChainAccountMock.mockResolvedValue(ownChainAccount);

		const differentChainID = utils.getRandomBytes(32);
		await ccRegistrationCommand.execute({
			...sampleExecuteContext,
			chainID: differentChainID,
		});

		expect(terminateChainInternalMock).toHaveBeenCalledTimes(1);
		expect(terminateChainInternalMock).toHaveBeenCalledWith(
			ccm.sendingChainID,
			expect.objectContaining({
				chainID: differentChainID,
				ccm,
			}),
		);
	});

	it('should execute successfully', async () => {
		// Arrange
		getChannelMock.mockResolvedValue(channelData);

		getOwnChainAccountMock.mockResolvedValue(ownChainAccount);

		await ccRegistrationCommand.execute(sampleExecuteContext);

		expect(terminateChainInternalMock).toHaveBeenCalledTimes(0);
	});
});
