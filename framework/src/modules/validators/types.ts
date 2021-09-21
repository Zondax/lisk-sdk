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

// import { APIContext } from '../../node/state_machine/types';

export interface ValidatorKeys {
	generatorKey: Buffer;
	blsKey: Buffer;
}

export interface GeneratorList {
	addresses: Buffer[];
}

export interface GenesisData {
	timestamp: number;
}

export interface APIInitArgs {
	config: {
		blockTime: number;
	};
}

/*
export interface ValidatorsAPI {
	getGeneratorAtTimestamp: (apiContext: APIContext, timestamp: number) => Promise<Buffer>;
	getSlotNumber: (apiContext: APIContext, timestamp: number) => number;
	getSlotTime: (apiContext: APIContext, slot: number) => number;
}
*/
