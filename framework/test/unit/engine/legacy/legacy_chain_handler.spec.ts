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

	beforeEach(() => {
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
		// CAUTION: This is copy of blockFixtures[0](19583715), ONLY height has changed
		legacyBlock19583716 = {
			header: {
				version: 2,
				timestamp: 1663169840,
				height: 19583716,
				previousBlockID: Buffer.from(
					'7866ac51d17ef72bf6937130e0602df0e16a8dcfd2627560c70dde9898e426a5',
					'hex',
				),
				transactionRoot: Buffer.from(
					'80683eece5491fb875566d0b68246e47bda5bae7269766d3437d668a27d7136e',
					'hex',
				),
				generatorPublicKey: Buffer.from(
					'fbac76743fad9448ed0b45fb4c97a62f81a358908aa14f6a2c76d2a8dc207141',
					'hex',
				),
				reward: BigInt('100000000'),
				asset: Buffer.from('0880a5ab091094a5ab091a10a15dd87df61606cd474f1038af29d5b3', 'hex'),
				signature: Buffer.from(
					'31c75cd21a676f19a3e5c72afd941a1c75bfb6f8088c15ea64c5e91c1e0fc37636e9a14b897b0dc61075db851fe0ba2b9c7b383eeb30d05d5dc846991aaa9108',
					'hex',
				),
				id: Buffer.from('31636e108a3ee5d22672631c582dbd8e06576b932f3cd303144abf165a3bc84d', 'hex'),
			},
			transactions: [
				Buffer.from(
					'0802100018960b2090a10f2a20fdb1de14521b437e61a89d1a2c54f20eef3a897819269ddfed7c2c6f6372ec85322e08e7f6e35e1214ef93860e2196de35f10cdf1b8b17adff7129dae41a11726f62696e686f6f64207061796f7574733a403f2c770abe2f6ad25bce6d83f8b51e8713554bc314042cbce86ff7f5033fdff6f041ad41af0ccb42d946c8c42b95d5f4aab90db6f5b3cef067385fe2c39c5309',
					'hex',
				),
			],
		};

		network = new Network({} as any);
		network.requestFromPeer = jest.fn();
		network.applyNodeInfo = jest.fn();

		legacyChainHandler = new LegacyChainHandler({ legacyConfig, network });
		legacyChainHandler.init({ db });

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
				}) as any,
			)
			.mockReturnValueOnce(
				encodeLegacyChainBracketInfo({
					startHeight: 0,
					snapshotBlockHeight: 0,
					lastBlockHeight: 19583716,
				}) as any,
			);

		jest
			.spyOn(legacyChainHandler['_storage'], 'getBlockByHeight')
			.mockReturnValueOnce(encodeBlock(legacyBlock19583716) as any); // we want to return blocks from this height ONCE

		// `getLegacyBlocksFromId` should return blocks in DESC order
		const reversedFixtures = blockFixtures.sort((a, b) => b.header.height - a.header.height);
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
		it('test behaviors', async () => {
			jest.spyOn(legacyChainHandler['_storage'], 'saveBlock');
			jest.spyOn(legacyChainHandler['_storage'], 'setLegacyChainBracketInfo');
			jest.spyOn(legacyChainHandler['_network'], 'applyNodeInfo');

			await legacyChainHandler.sync();

			expect(legacyChainHandler['_storage'].saveBlock).toHaveBeenCalledTimes(2);
			expect(legacyChainHandler['_storage'].setLegacyChainBracketInfo).toHaveBeenCalledTimes(1);
		});
	});
});
