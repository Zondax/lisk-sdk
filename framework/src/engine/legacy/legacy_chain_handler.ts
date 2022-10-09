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
import { P2PRequestPacket } from '@liskhq/lisk-p2p/dist-node/types';
import { Database } from '@liskhq/lisk-db';
import { LegacyConfig } from '../../types';
import { Network } from '../network';
import { getBlocksFromIdResponseSchema } from '../consensus/schema';
import { Storage } from './storage';
import { LegacyBlock, LegacyBlockBracket, Peer, LegacyChainBracketInfo } from './types';
import { decodeBlock, encodeBlock } from './codec';
import { PeerNotFoundWithLegacyInfo } from './errors';
import { validateLegacyBlock } from './validate';
import { legacyChainBracketInfoSchema } from './schemas';

interface LegacyChainHandlerArgs {
	legacyConfig: LegacyConfig;
	network: Network;
}

interface LegacyHandlerInitArgs {
	db: Database;
}

export class LegacyChainHandler {
	private readonly _network: Network;
	private _storage!: Storage;
	private readonly _legacyConfig: LegacyConfig;
	private _timeout!: NodeJS.Timeout;

	public constructor(args: LegacyChainHandlerArgs) {
		this._legacyConfig = args.legacyConfig;
		this._network = args.network;
	}

	public init(args: LegacyHandlerInitArgs): void {
		this._storage = new Storage(args.db);
	}

	public async sync() {
		if (!this._legacyConfig.sync) {
			return;
		}

		for (const bracket of this._legacyConfig.brackets) {
			const encodedBracketInfo = await this._storage.getLegacyChainBracketInfo(
				Buffer.from(bracket.snapshotBlockID, 'hex'),
			);
			const bracketInfo = codec.decode<LegacyChainBracketInfo>(
				legacyChainBracketInfoSchema,
				encodedBracketInfo,
			);
			if (bracket.startHeight === bracketInfo.lastBlockHeight) {
				continue;
			}
			const legacyBlock = decodeBlock(
				await this._storage.getBlockByHeight(bracketInfo.lastBlockHeight),
			).block;

			await this._trySyncBlocks(bracket, legacyBlock);
			await this._storage.setLegacyChainBracketInfo(
				Buffer.from(bracket.snapshotBlockID, 'hex'),
				bracketInfo,
			);
		}

		this._network.applyNodeInfo({
			legacy: this._legacyConfig.brackets.map(bracket =>
				Buffer.from(bracket.snapshotBlockID, 'hex'),
			),
		});

		clearTimeout(this._timeout);
	}

	private async _trySyncBlocks(bracket: LegacyBlockBracket, lastBlock: LegacyBlock) {
		try {
			await this.syncBlocks(bracket, lastBlock);
		} catch (err) {
			if (err instanceof PeerNotFoundWithLegacyInfo) {
				// eslint-disable-next-line @typescript-eslint/no-misused-promises
				this._timeout = setTimeout(async () => {
					await this._trySyncBlocks(bracket, lastBlock);
				}, 120000); // 2 mints = (60 * 2) * 1000
			} else {
				throw err;
			}
		}
	}

	/**
	 * Flow of syncing legacy blocks
	 *
	 * Check if we have `sync` property `true` in configuration
	 * getConnectedPeers from network
	 * Filter peers having their `legacy` buffer array property contains `snapshotBlockID`
	 * If there is no peer, throw error, this error will be used in outside function to retry calling `syncBlocks` after x amount of time
	 * Get a random peer from list of filtered peers with legacy info
	 * Make a request to that random peer by calling its `getLegacyBlocksFromId` method with `data` property set to `legacyBlock.header.id`
	 * Try to decode response data buffer into Block, apply penalty in case of error
	 * Start saving parsed blocks one by one
	 * repeat, if last parsed block height is still higher than bracket.startHeight
	 * finally, update node info
	 */
	// eslint-disable-next-line @typescript-eslint/member-ordering
	public async syncBlocks(bracket: LegacyBlockBracket, legacyBlock: LegacyBlock): Promise<void> {
		const connectedPeers = (this._network.getConnectedPeers() as unknown) as Peer[];
		const peersWithLegacyInfo = connectedPeers.filter(
			peer =>
				!!(peer.options as { legacy: Buffer[] }).legacy.find(snapshotBlockID =>
					snapshotBlockID.equals(Buffer.from(bracket.snapshotBlockID, 'hex')),
				),
		);
		if (!peersWithLegacyInfo) {
			throw new PeerNotFoundWithLegacyInfo('No peer found with legacy info.');
		}

		const randomPeerIndex = Math.trunc(Math.random() * peersWithLegacyInfo.length - 1);
		const { peerId } = peersWithLegacyInfo[randomPeerIndex];

		const p2PRequestPacket: P2PRequestPacket = {
			procedure: 'getLegacyBlocksFromId',
			data: legacyBlock.header.id,
		};

		const response = await this._network.requestFromPeer({ ...p2PRequestPacket, peerId });
		if (!(response.data as []).length) {
			return;
		}

		// `data` is expected to hold blocks in DESC order
		const { data } = response;
		let legacyBlocks: LegacyBlock[];
		try {
			// this part is needed to make sure `data` returns ONLY `{ blocks: Buffer[] }` & not any extra field
			const { blocks } = codec.decode<{ blocks: Buffer[] }>(
				getBlocksFromIdResponseSchema,
				data as Buffer,
			);
			this._applyValidation(blocks);
			legacyBlocks = blocks.map(block => decodeBlock(block).block);
		} catch (err) {
			this._network.applyPenaltyOnPeer({ peerId, penalty: 100 });
			return;
		}

		let lastBlock: LegacyBlock | undefined;
		for (const block of legacyBlocks) {
			if (block.header.height > bracket.startHeight) {
				await this._storage.saveBlock(
					block.header.id as Buffer,
					block.header.height,
					encodeBlock(block),
				);
				lastBlock = block;
			}
		}

		if (lastBlock && lastBlock.header.height > bracket.startHeight) {
			await this.syncBlocks(bracket, lastBlock);
		}
	}

	private _applyValidation(blocks: Buffer[]) {
		const sortedBlocks = [];
		for (let i = blocks.length - 1; i >= 0; i -= 1) {
			sortedBlocks.push(blocks[i]);
		}

		const sortedLegacyBlocks = sortedBlocks.map(block => decodeBlock(block).block);

		sortedBlocks.forEach((block, index) => {
			if (index < sortedBlocks.length - 1) {
				// skip the last block, since we don't have its next block available yet
				validateLegacyBlock(block, sortedLegacyBlocks[index + 1]);
			}
		});
	}
}
