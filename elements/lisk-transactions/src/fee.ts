/*
 * Copyright © 2020 Lisk Foundation
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
 *
 */

import { getBytes } from './sign';

interface BaseFee {
	readonly moduleID: number;
	readonly assetID: number;
	readonly baseFee: string;
}

interface Options {
	readonly minFeePerByte: number;
	readonly baseFees: BaseFee[];
	readonly numberOfSignatures: number;
}

const DEFAULT_MIN_FEE_PER_BYTE = 1000;
const DEFAULT_NUMBER_OF_SIGNATURES = 1;
const DEFAULT_BASE_FEE = '0';
const DEFAULT_SIGNATURE_BYTE_SIZE = 64;

export const calculateMinFee = (
	assetSchema: object,
	trx: Record<string, unknown>,
	options?: Options,
): bigint => {
	const size = getBytes(assetSchema, {
		...trx,
		signatures: new Array(options?.numberOfSignatures ?? DEFAULT_NUMBER_OF_SIGNATURES).fill(
			Buffer.alloc(DEFAULT_SIGNATURE_BYTE_SIZE),
		),
	}).length;
	const baseFee =
		options?.baseFees.find(bf => bf.moduleID === trx.moduleID && bf.assetID === trx.assetID)
			?.baseFee ?? DEFAULT_BASE_FEE;
	return BigInt(size * (options?.minFeePerByte ?? DEFAULT_MIN_FEE_PER_BYTE)) + BigInt(baseFee);
};

export const findRequiredMinFee = (
	assetSchema: object,
	trx: Record<string, unknown>,
	options?: Options,
): bigint => {
	const { fee, ...trxWithoutFee } = trx;
	trxWithoutFee.fee = BigInt(0);
	let minFee = calculateMinFee(assetSchema, trxWithoutFee, options);

	while (minFee > BigInt(trxWithoutFee.fee)) {
		// eslint-disable-next-line no-param-reassign
		trxWithoutFee.fee = minFee;
		minFee = calculateMinFee(assetSchema, trxWithoutFee, options);
	}
	return minFee;
};
