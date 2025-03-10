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

import { Logger } from '../../logger';
import { MethodContext, EventQueue } from '../../state_machine';
import { ImmutableMethodContext, ImmutableSubStore, SubStore } from '../../state_machine/types';
import { OutboxRoot } from './stores/outbox_root';
import { TerminatedOutboxAccount } from './stores/terminated_outbox';
import { TerminatedStateAccount } from './stores/terminated_state';

export type StoreCallback = (moduleID: Buffer, storePrefix: Buffer) => SubStore;
export type ImmutableStoreCallback = (moduleID: Buffer, storePrefix: Buffer) => ImmutableSubStore;
export interface CCMsg {
	readonly nonce: bigint;
	readonly module: string;
	readonly crossChainCommand: string;
	readonly sendingChainID: Buffer;
	readonly receivingChainID: Buffer;
	readonly fee: bigint;
	readonly status: number;
	readonly params: Buffer;
}

export interface ActiveValidator {
	blsKey: Buffer;
	bftWeight: bigint;
}

export interface MsgWitness {
	partnerChainOutboxSize: bigint;
	siblingHashes: Buffer[];
}

export interface OutboxRootWitness {
	bitmap: Buffer;
	siblingHashes: Buffer[];
}

export interface InboxUpdate {
	crossChainMessages: Buffer[];
	messageWitness: MsgWitness;
	outboxRootWitness: OutboxRootWitness;
}

export interface CCUpdateParams {
	sendingChainID: Buffer;
	certificate: Buffer;
	activeValidatorsUpdate: ActiveValidator[];
	newCertificateThreshold: bigint;
	inboxUpdate: InboxUpdate;
}

export interface CCMethodContext {
	getMethodContext: () => MethodContext;
	getStore: StoreCallback;
	logger: Logger;
	chainID: Buffer;
	eventQueue: EventQueue;
	feeAddress: Buffer;
	ccm: CCMsg;
}

export interface BeforeApplyCCMsgMethodContext extends CCMethodContext {
	ccu: CCUpdateParams;
	trsSender: Buffer;
}

export interface BeforeSendCCMsgMethodContext extends CCMethodContext {
	feeAddress: Buffer;
}

export interface BeforeRecoverCCMsgMethodContext extends CCMethodContext {
	trsSender: Buffer;
}

export interface RecoverCCMsgMethodContext extends CCMethodContext {
	terminatedChainID: Buffer;
	module: string;
	storePrefix: Buffer;
	storeKey: Buffer;
	storeValue: Buffer;
}

export interface SendInternalContext {
	module: string;
	crossChainCommand: string;
	receivingChainID: Buffer;
	fee: bigint;
	status: number;
	params: Buffer;
	timestamp?: number;
	getMethodContext: () => MethodContext;
	getStore: StoreCallback;
	logger: Logger;
	chainID: Buffer;
	eventQueue: EventQueue;
	feeAddress: Buffer;
}

export interface TerminateChainContext {
	getMethodContext: () => MethodContext;
	getStore: StoreCallback;
	logger: Logger;
	chainID: Buffer;
	eventQueue: EventQueue;
}

export interface CCMApplyContext {
	getMethodContext: () => MethodContext;
	getStore: StoreCallback;
	logger: Logger;
	chainID: Buffer;
	eventQueue: EventQueue;
	feeAddress: Buffer;
	ccm: CCMsg;
	ccu: CCUpdateParams;
	trsSender: Buffer;
	ccmSize: bigint;
}

export interface CCMForwardContext {
	getMethodContext: () => MethodContext;
	getStore: StoreCallback;
	logger: Logger;
	chainID: Buffer;
	eventQueue: EventQueue;
	feeAddress: Buffer;
	ccm: CCMsg;
	ccu: CCUpdateParams;
}

export interface LastCertificate {
	height: number;
	timestamp: number;
	stateRoot: Buffer;
	validatorsHash: Buffer;
}

export interface LastCertificateJSON {
	height: number;
	timestamp: number;
	stateRoot: string;
	validatorsHash: string;
}

export interface ChainAccount {
	name: string;
	lastCertificate: LastCertificate;
	status: number;
}

export interface ChainAccountJSON {
	name: string;
	lastCertificate: LastCertificateJSON;
	status: number;
}

export interface OwnChainAccount {
	name: string;
	id: Buffer;
	nonce: bigint;
}

export interface OwnChainAccountJSON {
	name: string;
	id: string;
	nonce: string;
}

export interface Inbox {
	appendPath: Buffer[];
	size: number;
	root: Buffer;
}

export interface InboxJSON {
	appendPath: string[];
	size: number;
	root: string;
}

export interface Outbox {
	appendPath: Buffer[];
	size: number;
	root: Buffer;
}

export interface OutboxJSON {
	appendPath: string[];
	size: number;
	root: string;
}

export interface MessageFeeTokenID {
	chainID: Buffer;
	localID: Buffer;
}

export interface MessageFeeTokenIDJSON {
	chainID: string;
	localID: string;
}

export interface ChannelData {
	inbox: Inbox;
	outbox: Outbox;
	partnerChainOutboxRoot: Buffer;
	messageFeeTokenID: MessageFeeTokenID;
}

export interface ChannelDataJSON {
	inbox: InboxJSON;
	outbox: OutboxJSON;
	partnerChainOutboxRoot: string;
	messageFeeTokenID: MessageFeeTokenIDJSON;
}

export interface CCCommandExecuteContext {
	logger: Logger;
	chainID: Buffer;
	eventQueue: EventQueue;
	ccm: CCMsg;
	ccmSize: bigint;
	getMethodContext: () => MethodContext;
	getStore: StoreCallback;
	feeAddress: Buffer;
}

export interface ActiveValidators {
	blsKey: Buffer;
	bftWeight: bigint;
}

export interface RegistrationParametersValidator {
	blsKey: Buffer;
	bftWeight: bigint;
}

export interface SidechainRegistrationParams {
	name: string;
	chainID: Buffer;
	initValidators: RegistrationParametersValidator[];
	certificateThreshold: bigint;
	sidechainRegistrationFee: bigint;
}

export interface MainchainRegistrationParams {
	ownChainID: Buffer;
	ownName: string;
	mainchainValidators: RegistrationParametersValidator[];
	signature: Buffer;
	aggregationBits: Buffer;
}

export interface ValidatorKeys {
	generatorKey: Buffer;
	blsKey: Buffer;
}

export interface ValidatorsMethod {
	getValidatorAccount(
		methodContext: ImmutableMethodContext,
		address: Buffer,
	): Promise<ValidatorKeys>;
}

export interface CrossChainCommandDependencies {
	validatorsMethod: ValidatorsMethod;
}

export interface ValidatorsHashInput {
	activeValidators: ActiveValidator[];
	certificateThreshold: bigint;
}

export interface MessageRecoveryParams {
	chainID: Buffer;
	crossChainMessages: Buffer[];
	idxs: number[];
	siblingHashes: Buffer[];
}

export interface MessageRecoveryVerificationParams {
	crossChainMessages: Buffer[];
	idxs: number[];
	siblingHashes: Buffer[];
}

export interface StoreEntry {
	storePrefix: Buffer;
	storeKey: Buffer;
	storeValue: Buffer;
	bitmap: Buffer;
}

export interface StateRecoveryParams {
	chainID: Buffer;
	module: string;
	storeEntries: StoreEntry[];
	siblingHashes: Buffer[];
}

export interface StateRecoveryInitParams {
	chainID: Buffer;
	sidechainChainAccount: Buffer;
	bitmap: Buffer;
	siblingHashes: Buffer[];
}

export interface CrossChainUpdateTransactionParams {
	sendingChainID: Buffer;
	certificate: Buffer;
	activeValidatorsUpdate: ActiveValidator[];
	newCertificateThreshold: bigint;
	inboxUpdate: InboxUpdate;
}

export interface ChainValidators {
	activeValidators: ActiveValidator[];
	certificateThreshold: bigint;
}

export interface ChainID {
	id: Buffer;
}

export interface GenesisInteroperabilityStore {
	outboxRootSubstore: {
		storeKey: Buffer;
		storeValue: OutboxRoot;
	}[];
	chainDataSubstore: {
		storeKey: Buffer;
		storeValue: ChainAccount;
	}[];
	channelDataSubstore: {
		storeKey: Buffer;
		storeValue: ChannelData;
	}[];
	chainValidatorsSubstore: {
		storeKey: Buffer;
		storeValue: ValidatorsHashInput;
	}[];
	ownChainDataSubstore: {
		storeKey: Buffer;
		storeValue: OwnChainAccount;
	}[];
	terminatedStateSubstore: {
		storeKey: Buffer;
		storeValue: TerminatedStateAccount;
	}[];
	terminatedOutboxSubstore: {
		storeKey: Buffer;
		storeValue: TerminatedOutboxAccount;
	}[];
	registeredNamesSubstore: {
		storeKey: Buffer;
		storeValue: ChainID;
	}[];
	registeredNetworkIDsSubstore: {
		storeKey: Buffer;
		storeValue: ChainID;
	}[];
}
