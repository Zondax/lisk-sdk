/* eslint-disable max-classes-per-file */
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

import { utils } from '@liskhq/lisk-cryptography';
import { Database } from '@liskhq/lisk-db';
import * as path from 'path';
import * as fs from 'fs';
import { codec } from '@liskhq/lisk-codec';
import { LegacyConfig } from '../../../../src';
import { LegacyChainHandler } from '../../../../src/engine/legacy/legacy_chain_handler';
import { Network } from '../../../../src/engine/network';
import { encodeBlock, encodeLegacyChainBracketInfo } from '../../../../src/engine/legacy/codec';
import { Peer, LegacyBlock } from '../../../../src/engine/legacy/types';
import { getBlocksFromIdResponseSchema } from '../../../../src/engine/consensus/schema';
import { blockFixtures } from './fixtures';

const randomSnapshotBlockID = utils.getRandomBytes(20);
const expectedSnapshotBlockID = utils.getRandomBytes(20);

// https://lisk.observer/block/19583716
describe('Legacy Chain Handler', () => {
	let legacyChainHandler: LegacyChainHandler;
	let legacyConfig: LegacyConfig;
	let peers: Peer[];
	let network: Network;
	const dir = path.join(__dirname, 'legacy.db');
	const db = new Database(dir);
	let legacyBlock19583716: LegacyBlock;

	beforeEach(async () => {
		legacyConfig = {
			sync: true,
			brackets: [
				{
					startHeight: 0,
					snapshotBlockID: randomSnapshotBlockID.toString('hex'),
					snapshotHeight: 100,
				},
				{
					startHeight: 19583710,
					snapshotBlockID: expectedSnapshotBlockID.toString('hex'),
					snapshotHeight: 19583716,
				},
			],
		};
		peers = [
			{
				peerId: 'peerId-1',
				options: {
					legacy: [expectedSnapshotBlockID],
				},
			},
			{
				peerId: 'peerId-2',
				options: {
					legacy: [randomSnapshotBlockID, expectedSnapshotBlockID],
				},
			},
		];
		// eslint-disable-next-line prefer-destructuring
		legacyBlock19583716 = blockFixtures[2];

		network = new Network({} as any);
		network.requestFromPeer = jest.fn();
		network.applyNodeInfo = jest.fn();

		legacyChainHandler = new LegacyChainHandler({ legacyConfig, network });
		await legacyChainHandler.init({ db });

		jest.spyOn(legacyChainHandler['_network'], 'getConnectedPeers').mockImplementation(() => {
			return peers as any;
		});

		jest
			.spyOn(legacyChainHandler['_storage'], 'getLegacyChainBracketInfo')
			.mockReturnValueOnce(
				encodeLegacyChainBracketInfo({
					startHeight: 0,
					snapshotBlockHeight: 0,
					lastBlockHeight: 0,
				}) as any, // this means this bracket is already synced, since it's lastBlockHeight equals bracket's startHeight
			)
			.mockReturnValueOnce(
				encodeLegacyChainBracketInfo({
					startHeight: 19583710,
					snapshotBlockHeight: 19583716,
					lastBlockHeight: 19583716,
				}) as any,
			);

		jest
			.spyOn(legacyChainHandler['_storage'], 'getBlockByHeight')
			.mockReturnValueOnce(encodeBlock(legacyBlock19583716) as any); // we want to return blocks from this height ONCE

		// `getLegacyBlocksFromId` should return blocks in DESC order
		const reversedFixtures = blockFixtures
			.slice(0, 2)
			.sort((a, b) => b.header.height - a.header.height);
		const encodedBlocks = reversedFixtures.map(block => encodeBlock(block));

		jest
			.spyOn(network, 'requestFromPeer')
			.mockReturnValueOnce({
				data: codec.encode(getBlocksFromIdResponseSchema, { blocks: encodedBlocks }),
			} as any)
			.mockReturnValueOnce({
				data: [],
			} as any);
	});

	afterAll(() => {
		db.close();
		fs.rmdirSync(dir, { recursive: true });
	});

	describe('constructor', () => {
		it('should set legacy config properties', () => {
			expect(legacyChainHandler['_legacyConfig']).toEqual(legacyConfig);
		});
	});

	describe('sync', () => {
		it('should have expected behaviors', async () => {
			jest.spyOn(legacyChainHandler['_storage'], 'saveBlock');
			jest.spyOn(legacyChainHandler['_storage'], 'setLegacyChainBracketInfo');
			jest.spyOn(legacyChainHandler['_network'], 'applyNodeInfo');

			await legacyChainHandler.sync();

			expect(legacyChainHandler['_storage'].saveBlock).toHaveBeenCalledTimes(2);
			expect(legacyChainHandler['_storage'].setLegacyChainBracketInfo).toHaveBeenCalledTimes(1);
		});
	});
});
