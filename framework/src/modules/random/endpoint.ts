/*
 * Copyright © 2021 Lisk Foundation
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

import { validator } from '@liskhq/lisk-validator';
import * as cryptography from '@liskhq/lisk-cryptography';
import { ModuleEndpointContext } from '../../types';
import { BaseEndpoint } from '../base_endpoint';
import { ADDRESS_LENGTH, EMPTY_KEY } from './constants';
import {
	GetSeedsResponse,
	GetSeedUsageRequest,
	getSeedUsageRequestSchema,
	GetSeedUsageResponse,
	HasSeedRequest,
	HasSeedResponse,
	hasSeedSchema,
	isSeedRevealValidRequestSchema,
	SetSeedRequest,
	setSeedRequestSchema,
} from './schemas';
import { ValidatorRevealsStore } from './stores/validator_reveals';
import { getSeedRevealValidity } from './utils';
import { HashOnionStore } from './stores/hash_onion';
import { UsedHashOnionsStore } from './stores/used_hash_onions';

export class RandomEndpoint extends BaseEndpoint {
	public async isSeedRevealValid(ctx: ModuleEndpointContext): Promise<{ valid: boolean }> {
		validator.validate(isSeedRevealValidRequestSchema, ctx.params);

		const { generatorAddress, seedReveal } = ctx.params;
		const randomDataStore = this.stores.get(ValidatorRevealsStore);
		const { validatorReveals } = await randomDataStore.get(ctx, EMPTY_KEY);

		return {
			valid: getSeedRevealValidity(
				Buffer.from(generatorAddress as string, 'hex'),
				Buffer.from(seedReveal as string, 'hex'),
				validatorReveals,
			),
		};
	}

	public async setSeed(ctx: ModuleEndpointContext): Promise<void> {
		validator.validate<SetSeedRequest>(setSeedRequestSchema, ctx.params);

		const address = Buffer.from(ctx.params.address, 'hex');
		const seed = ctx.params.seed
			? Buffer.from(ctx.params.seed, 'hex')
			: cryptography.utils.generateHashOnionSeed();
		const count = ctx.params.count ?? 1000000;
		const distance = ctx.params.distance ?? 1000;

		const hashes = cryptography.utils.hashOnion(seed, count, distance) as Buffer[];
		const hashOnion = { count, distance, hashes };
		const hashOnionStore = this.offchainStores.get(HashOnionStore);
		await hashOnionStore.set(ctx, address, hashOnion);
	}

	public async getSeeds(ctx: ModuleEndpointContext): Promise<GetSeedsResponse> {
		const hashOnionStore = this.offchainStores.get(HashOnionStore);
		const hashOnions = await hashOnionStore.iterate(ctx, {
			gte: Buffer.alloc(ADDRESS_LENGTH, 0),
			lte: Buffer.alloc(ADDRESS_LENGTH, 255),
		});

		const seeds = hashOnions.map(({ key, value }) => ({
			address: key.toString('hex'),
			seed: value.hashes[value.hashes.length - 1].toString('hex'),
			count: value.count,
			distance: value.distance,
		}));

		return { seeds };
	}

	public async hasSeed(ctx: ModuleEndpointContext): Promise<HasSeedResponse> {
		validator.validate<HasSeedRequest>(hasSeedSchema, ctx.params);

		const address = Buffer.from(ctx.params.address, 'hex');
		const hashOnionStore = this.offchainStores.get(HashOnionStore);
		const hasSeed = await hashOnionStore.has(ctx, address);
		if (!hasSeed) {
			return {
				hasSeed,
				remaining: 0,
			};
		}
		const hashOnion = await hashOnionStore.get(ctx, address);
		const usedHashOnionStore = this.offchainStores.get(UsedHashOnionsStore);
		const usedHashOnion = await usedHashOnionStore.getLatest(ctx, address);
		if (!usedHashOnion) {
			return {
				hasSeed,
				remaining: hashOnion.count,
			};
		}

		const remaining = hashOnion.count - usedHashOnion.count;

		return { hasSeed, remaining };
	}

	public async getSeedUsage(ctx: ModuleEndpointContext): Promise<GetSeedUsageResponse> {
		validator.validate<GetSeedUsageRequest>(getSeedUsageRequestSchema, ctx.params);

		const address = Buffer.from(ctx.params.address, 'hex');
		const hashOnionStore = this.offchainStores.get(HashOnionStore);
		const hashOnion = await hashOnionStore.get(ctx, address);
		const seed = hashOnion.hashes[hashOnion.hashes.length - 1].toString('hex');

		const usedHashOnionStore = this.offchainStores.get(UsedHashOnionsStore);
		const usedHashOnion = await usedHashOnionStore.getLatest(ctx, address);
		if (!usedHashOnion) {
			return {
				count: 0,
				height: 0,
				seed,
			};
		}

		return { height: usedHashOnion.height, count: usedHashOnion.count, seed };
	}
}
