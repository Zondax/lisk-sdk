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
import { CCM_STATUS_OK, CROSS_CHAIN_COMMAND_ID_REGISTRATION } from '../../constants';
import { MainchainInteroperabilityStore } from '../store';
import { registrationCCMParamsSchema } from '../../schema';
import { CCCommandExecuteContext, MessageFeeTokenID } from '../../types';
import { createCCMsgBeforeSendContext } from '../../context';
import { SubStore } from '../../../../node/state_machine/types';
import { BaseInteroperabilityCCCommand } from '../../base_interoperability_cc_commands';

interface CCMRegistrationParams {
	networkID: Buffer;
	name: string;
	messageFeeTokenID: MessageFeeTokenID;
}

export class MainchainCCRegistrationCommand extends BaseInteroperabilityCCCommand {
	public ID = CROSS_CHAIN_COMMAND_ID_REGISTRATION;
	public name = 'registration';
	public schema = registrationCCMParamsSchema;

	public async execute(ctx: CCCommandExecuteContext): Promise<void> {
		const { ccm } = ctx;
		const decodedParams = codec.decode<CCMRegistrationParams>(
			registrationCCMParamsSchema,
			ccm.params,
		);
		const interoperabilityStore = this._getInteroperabilityStore(ctx.getStore);
		const sendingChainChannelAccount = await interoperabilityStore.getChannel(ccm.sendingChainID);
		const ownChainAccount = await interoperabilityStore.getOwnChainAccount();

		if (
			sendingChainChannelAccount.inbox.size !== 1 ||
			ccm.status !== CCM_STATUS_OK ||
			ownChainAccount.id !== ccm.receivingChainID ||
			ownChainAccount.name !== decodedParams.name ||
			sendingChainChannelAccount.messageFeeTokenID.chainID !==
				decodedParams.messageFeeTokenID.chainID ||
			sendingChainChannelAccount.messageFeeTokenID.localID !==
				decodedParams.messageFeeTokenID.localID ||
			!decodedParams.networkID.equals(ctx.networkIdentifier) ||
			ccm.nonce !== BigInt(0) // Only in mainchain
		) {
			const beforeSendContext = createCCMsgBeforeSendContext({
				ccm,
				eventQueue: ctx.eventQueue,
				getAPIContext: ctx.getAPIContext,
				getStore: ctx.getStore,
				logger: ctx.logger,
				networkIdentifier: ctx.networkIdentifier,
				feeAddress: ctx.feeAddress,
			});
			await interoperabilityStore.terminateChainInternal(ccm.sendingChainID, beforeSendContext);
		}
	}

	private _getInteroperabilityStore(getStore: (moduleID: number, storePrefix: number) => SubStore) {
		return new MainchainInteroperabilityStore(this.moduleID, getStore, this._interoperableCCAPIs);
	}
}
