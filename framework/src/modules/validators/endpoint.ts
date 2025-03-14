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

import { address as cryptoAddress, bls } from '@liskhq/lisk-cryptography';
import { validator } from '@liskhq/lisk-validator';
import { NotFoundError } from '@liskhq/lisk-db';
import { ModuleEndpointContext } from '../../types';
import { BaseEndpoint } from '../base_endpoint';
import {
	ValidateBLSKeyRequest,
	validateBLSKeyRequestSchema,
	GetValidatorRequest,
	getValidatorRequestSchema,
} from './schemas';
import { BLSKeyStore } from './stores/bls_keys';
import { ValidatorKeysStore } from './stores/validator_keys';

export class ValidatorsEndpoint extends BaseEndpoint {
	public async validateBLSKey(ctx: ModuleEndpointContext): Promise<{ valid: boolean }> {
		validator.validate<ValidateBLSKeyRequest>(validateBLSKeyRequestSchema, ctx.params);

		const req = ctx.params;
		const { proofOfPossession, blsKey } = req;

		const blsKeysSubStore = this.stores.get(BLSKeyStore);

		let persistedValue;

		try {
			persistedValue = await blsKeysSubStore.get(ctx, Buffer.from(blsKey, 'hex'));
		} catch (error) {
			if (!(error instanceof NotFoundError)) {
				throw error;
			}
		}

		if (persistedValue) {
			return { valid: false };
		}

		return {
			valid: bls.popVerify(Buffer.from(blsKey, 'hex'), Buffer.from(proofOfPossession, 'hex')),
		};
	}

	public async getValidator(
		ctx: ModuleEndpointContext,
	): Promise<{ generatorKey: string; blsKey: string }> {
		validator.validate<GetValidatorRequest>(getValidatorRequestSchema, ctx.params);
		const validatorsKeysSubStore = this.stores.get(ValidatorKeysStore);

		let persistedValue;

		try {
			persistedValue = await validatorsKeysSubStore.get(
				ctx,
				cryptoAddress.getAddressFromLisk32Address(ctx.params.address),
			);
		} catch (error) {
			if (!(error instanceof NotFoundError)) {
				throw error;
			}

			return {
				generatorKey: '',
				blsKey: '',
			};
		}

		return {
			generatorKey: persistedValue?.generatorKey.toString('hex'),
			blsKey: persistedValue?.blsKey.toString('hex'),
		};
	}
}
