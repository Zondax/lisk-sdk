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

import { BaseAPI } from '../base_api';
import { ImmutableAPIContext } from '../../node/state_machine';
import { AuthData, authAccountSchema } from './schemas';
import { STORE_PREFIX_AUTH } from './constants';

export class AuthAPI extends BaseAPI {
	public async getAuthAccount(
		apiContext: ImmutableAPIContext,
		address: Buffer,
	): Promise<AuthData | {}> {
		const authDataStore = apiContext.getStore(this.moduleID, STORE_PREFIX_AUTH);
		let authData;
		try {
			authData = await authDataStore.getWithSchema<AuthData>(address, authAccountSchema);
		} catch (error) {
			authData = {};
		}

		return authData;
	}
}
