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

import { genesisAuthStoreSchema } from '../../auth/schemas';
import { ModuleMetadata } from '../../base_module';
import { BaseInteroperabilityModule } from '../base_interoperability_module';
import { MainchainInteroperabilityMethod } from './method';
import { MainchainCCMethod } from './cc_method';
import { MainchainInteroperabilityEndpoint } from './endpoint';
import {
	getChainAccountRequestSchema,
	getChannelRequestSchema,
	getTerminatedStateAccountRequestSchema,
	getTerminatedOutboxAccountRequestSchema,
} from '../schemas';
import { GenesisBlockExecuteContext } from '../../../state_machine';
import { initGenesisStateUtil } from '../utils';
import {
	chainAccountSchema,
	allChainAccountsSchema,
	ChainAccountStore,
} from '../stores/chain_account';
import { ChannelDataStore, channelSchema } from '../stores/channel_data';
import { ownChainAccountSchema, OwnChainAccountStore } from '../stores/own_chain_account';
import { terminatedStateSchema } from '../stores/terminated_state';
import { terminatedOutboxSchema } from '../stores/terminated_outbox';
import { TokenMethod } from '../../token';
import { SidechainRegistrationCommand } from './commands';
import { CcmProcessedEvent } from '../events/ccm_processed';
import { ChainAccountUpdatedEvent } from '../events/chain_account_updated';
import { RegisteredNamesStore } from '../stores/registered_names';
import { OutboxRootStore } from '../stores/outbox_root';
import { ChainValidatorsStore } from '../stores/chain_validators';

export class MainchainInteroperabilityModule extends BaseInteroperabilityModule {
	public crossChainMethod = new MainchainCCMethod(this.stores, this.events);
	public method = new MainchainInteroperabilityMethod(
		this.stores,
		this.events,
		this.interoperableCCMethods,
	);
	public endpoint = new MainchainInteroperabilityEndpoint(
		this.stores,
		this.offchainStores,
		this.interoperableCCMethods,
	);

	private readonly _sidechainRegistrationCommand = new SidechainRegistrationCommand(
		this.stores,
		this.events,
		this.interoperableCCMethods,
		this.interoperableCCCommands,
	);

	// eslint-disable-next-line @typescript-eslint/member-ordering
	public commands = [this._sidechainRegistrationCommand];

	public constructor() {
		super();
		this.stores.register(RegisteredNamesStore, new RegisteredNamesStore(this.name));
		this.stores.register(ChainAccountStore, new ChainAccountStore(this.name));
		this.stores.register(OwnChainAccountStore, new OwnChainAccountStore(this.name));
		this.stores.register(ChannelDataStore, new ChannelDataStore(this.name));
		this.stores.register(OutboxRootStore, new OutboxRootStore(this.name));
		this.stores.register(ChainValidatorsStore, new ChainValidatorsStore(this.name));
		this.events.register(ChainAccountUpdatedEvent, new ChainAccountUpdatedEvent(this.name));
		this.events.register(CcmProcessedEvent, new CcmProcessedEvent(this.name));
	}

	public addDependencies(tokenMethod: TokenMethod) {
		this._sidechainRegistrationCommand.addDependencies(tokenMethod);
	}

	public metadata(): ModuleMetadata {
		return {
			endpoints: [
				{
					name: this.endpoint.getChainAccount.name,
					request: getChainAccountRequestSchema,
					response: chainAccountSchema,
				},
				{
					name: this.endpoint.getAllChainAccounts.name,
					request: getChainAccountRequestSchema,
					response: allChainAccountsSchema,
				},
				{
					name: this.endpoint.getChannel.name,
					request: getChannelRequestSchema,
					response: channelSchema,
				},
				{
					name: this.endpoint.getOwnChainAccount.name,
					response: ownChainAccountSchema,
				},
				{
					name: this.endpoint.getTerminatedStateAccount.name,
					request: getTerminatedStateAccountRequestSchema,
					response: terminatedStateSchema,
				},
				{
					name: this.endpoint.getTerminatedOutboxAccount.name,
					request: getTerminatedOutboxAccountRequestSchema,
					response: terminatedOutboxSchema,
				},
			],
			commands: this.commands.map(command => ({
				name: command.name,
				params: command.schema,
			})),
			events: [],
			assets: [
				{
					version: 0,
					data: genesisAuthStoreSchema,
				},
			],
		};
	}

	public async initGenesisState(context: GenesisBlockExecuteContext): Promise<void> {
		await initGenesisStateUtil(context, this.stores);
	}
}
