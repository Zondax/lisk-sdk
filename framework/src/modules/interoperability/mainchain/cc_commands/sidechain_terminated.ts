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
import { BaseInteroperabilityCCCommand } from '../../base_interoperability_cc_commands';
import {
	CROSS_CHAIN_COMMAND_ID_SIDECHAIN_TERMINATED_BUFFER,
	MAINCHAIN_ID_BUFFER,
} from '../../constants';
import { createCCMsgBeforeSendContext } from '../../context';
import { sidechainTerminatedCCMParamsSchema } from '../../schema';
import { CCCommandExecuteContext, StoreCallback } from '../../types';
import { MainchainInteroperabilityStore } from '../store';

interface CCMSidechainTerminatedParams {
	chainID: Buffer;
	stateRoot: Buffer;
}

export class MainchainCCSidechainTerminatedCommand extends BaseInteroperabilityCCCommand {
	public ID = CROSS_CHAIN_COMMAND_ID_SIDECHAIN_TERMINATED_BUFFER;
	public name = 'sidechainTerminated';
	public schema = sidechainTerminatedCCMParamsSchema;

	public async execute(context: CCCommandExecuteContext): Promise<void> {
		const { ccm } = context;
		if (!ccm) {
			throw new Error('CCM to execute sidechain terminated cross chain command is missing.');
		}
		const decodedParams = codec.decode<CCMSidechainTerminatedParams>(
			sidechainTerminatedCCMParamsSchema,
			ccm.params,
		);
		const interoperabilityStore = this.getInteroperabilityStore(context.getStore);

		if (ccm.sendingChainID.equals(MAINCHAIN_ID_BUFFER)) {
			const isTerminated = await interoperabilityStore.hasTerminatedStateAccount(
				decodedParams.chainID,
			);
			if (isTerminated) {
				return;
			}
			await interoperabilityStore.createTerminatedStateAccount(
				decodedParams.chainID,
				decodedParams.stateRoot,
			);
		} else {
			const beforeSendContext = createCCMsgBeforeSendContext({
				ccm,
				eventQueue: context.eventQueue,
				getAPIContext: context.getAPIContext,
				getStore: context.getStore,
				logger: context.logger,
				networkIdentifier: context.networkIdentifier,
				feeAddress: context.feeAddress,
			});
			await interoperabilityStore.terminateChainInternal(ccm.sendingChainID, beforeSendContext);
		}
	}

	protected getInteroperabilityStore(getStore: StoreCallback): MainchainInteroperabilityStore {
		return new MainchainInteroperabilityStore(this.moduleID, getStore, this.interoperableCCAPIs);
	}
}
