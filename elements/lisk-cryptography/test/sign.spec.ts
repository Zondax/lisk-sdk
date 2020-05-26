/*
 * Copyright © 2019 Lisk Foundation
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
import { makeInvalid } from './helpers';
import {
	SignedMessageWithOnePassphrase,
	signMessageWithPassphrase,
	verifyMessageWithPublicKey,
	printSignedMessage,
	signAndPrintMessage,
	signData,
	signDataWithPassphrase,
	signDataWithPrivateKey,
	verifyData,
	digestMessage,
} from '../src/sign';
// Require is used for stubbing
// eslint-disable-next-line
const keys = require('../src/keys');

const changeLength = (str: string): string => `00${str}`;

describe('sign', () => {
	const defaultPassphrase =
		'minute omit local rare sword knee banner pair rib museum shadow juice';
	const defaultPrivateKey =
		'314852d7afb0d4c283692fef8a2cb40e30c7a5df2ed79994178c10ac168d6d977ef45cd525e95b7a86244bbd4eb4550914ad06301013958f4dd64d32ef7bc588';
	const defaultPublicKey =
		'7ef45cd525e95b7a86244bbd4eb4550914ad06301013958f4dd64d32ef7bc588';
	const defaultMessage = 'Some default text.';
	const defaultSignature =
		'68937004b6720d7e1902ef05a577e6d9f9ab2756286b1f2ae918f8a0e5153c15e4f410916076f750b708f8979be2430e4cfc7ebb523ae1905d2ea1f5d24ce700';
	const defaultPrintedMessage = `
-----BEGIN LISK SIGNED MESSAGE-----
-----MESSAGE-----
${defaultMessage}
-----PUBLIC KEY-----
${defaultPublicKey}
-----SIGNATURE-----
${defaultSignature}
-----END LISK SIGNED MESSAGE-----
`.trim();

	const defaultData = Buffer.from('This is some data');
	const defaultDataSignature =
		'b8704e11c4d9fad9960c7b6a69dcf48c1bede5b74ed8974cd005d9a407deef618dd800fe69ceed1fd52bb1e0881e71aec137c35b90eda9afe93716a5652ee009';

	let defaultSignedMessage: SignedMessageWithOnePassphrase;

	beforeEach(() => {
		defaultSignedMessage = {
			message: defaultMessage,
			publicKey: defaultPublicKey,
			signature: defaultSignature,
		};

		jest
			.spyOn(keys, 'getAddressAndPublicKeyFromPassphrase')
			.mockImplementation(() => {
				return {
					privateKey: Buffer.from(defaultPrivateKey, 'hex'),
					publicKey: Buffer.from(defaultPublicKey, 'hex'),
				};
			});
	});

	describe('#digestMessage', () => {
		const strGenerator = (len: number, chr: string): string => chr.repeat(len);

		it('should create message digest for message with length = 0', () => {
			const msgBytes = digestMessage('');
			const expectedMessageBytes = Buffer.from(
				'3fdb82ac2a879b647f4f27f3fbd1c27e0d4e278f830b76295604035330163b79',
				'hex',
			);
			expect(msgBytes).toEqual(expectedMessageBytes);
		});
		it('should create message digest for message in length range 1 - 253', () => {
			const msgBytes = digestMessage(strGenerator(250, 'a'));
			const expectedMessageBytes = Buffer.from(
				'12832c687d950513aa5db6198b84809eb8fd7ff1c8963dca48ea57278523ec67',
				'hex',
			);
			expect(msgBytes).toEqual(expectedMessageBytes);
		});
		it('should create message digest for message in length range 254 - 65536', () => {
			const msgBytes = digestMessage(strGenerator(65535, 'a'));
			const expectedMessageBytes = Buffer.from(
				'73da94220312e71eb5c55c94fdddca3c06a6c18cb74a4a4a2cee1a82875c2450',
				'hex',
			);
			expect(msgBytes).toEqual(expectedMessageBytes);
		});
		it('should create message digest for message in length range 65537 - 4294967296', () => {
			const msgBytes = digestMessage(strGenerator(6710886, 'a'));
			const expectedMessageBytes = Buffer.from(
				'7c51817b5c31c4d04e9ffcf2e78859d6522b124f218c789a8f721b5f3e6b295d',
				'hex',
			);
			expect(msgBytes).toEqual(expectedMessageBytes);
		});
		// higest range (length > 4294967296) is not practical to test
		// but it is covered by `varuint-bitcoin` library
	});

	describe('#signMessageWithPassphrase', () => {
		it('should create a signed message using a secret passphrase', () => {
			const signedMessage = signMessageWithPassphrase(
				defaultMessage,
				defaultPassphrase,
			);
			expect(signedMessage).toEqual(defaultSignedMessage);
		});
	});

	describe('#verifyMessageWithPublicKey', () => {
		it('should detect invalid publicKeys', () => {
			expect(
				verifyMessageWithPublicKey.bind(null, {
					message: defaultMessage,
					signature: defaultSignature,
					publicKey: changeLength(defaultPublicKey),
				}),
			).toThrow('Invalid publicKey, expected 32-byte publicKey');
		});

		it('should detect invalid signatures', () => {
			expect(
				verifyMessageWithPublicKey.bind(null, {
					message: defaultMessage,
					signature: changeLength(defaultSignature),
					publicKey: defaultPublicKey,
				}),
			).toThrow('Invalid signature length, expected 64-byte signature');
		});

		it('should return false if the signature is invalid', () => {
			const verification = verifyMessageWithPublicKey({
				message: defaultMessage,
				signature: makeInvalid(defaultSignature),
				publicKey: defaultPublicKey,
			});
			expect(verification).toBe(false);
		});

		it('should return true if the signature is valid', () => {
			const verification = verifyMessageWithPublicKey(defaultSignedMessage);
			expect(verification).toBe(true);
		});
	});

	describe('#printSignedMessage', () => {
		it('should wrap a single signed message into a printed Lisk template', () => {
			const printedMessage = printSignedMessage({
				message: defaultMessage,
				signature: defaultSignature,
				publicKey: defaultPublicKey,
			});
			expect(printedMessage).toBe(defaultPrintedMessage);
		});
	});

	describe('#signAndPrintMessage', () => {
		it('should sign the message once and wrap it into a printed Lisk template', () => {
			const signedAndPrintedMessage = signAndPrintMessage(
				defaultMessage,
				defaultPassphrase,
			);
			expect(signedAndPrintedMessage).toBe(defaultPrintedMessage);
		});
	});

	describe('#signData', () => {
		let signature: string;

		beforeEach(async () => {
			signature = signData(defaultData, defaultPassphrase);
			return Promise.resolve();
		});

		it('should sign a transaction', () => {
			expect(signature).toBe(defaultDataSignature);
		});
	});

	describe('#signDataWithPassphrase', () => {
		let signature: string;

		beforeEach(async () => {
			signature = signDataWithPassphrase(defaultData, defaultPassphrase);
			return Promise.resolve();
		});

		it('should sign a transaction', () => {
			expect(signature).toBe(defaultDataSignature);
		});
	});

	describe('#signDataWithPrivateKey', () => {
		let signature: string;

		beforeEach(async () => {
			signature = signDataWithPrivateKey(
				defaultData,
				Buffer.from(defaultPrivateKey, 'hex'),
			);
			return Promise.resolve();
		});

		it('should sign a transaction', () => {
			expect(signature).toBe(defaultDataSignature);
		});
	});

	describe('#verifyData', () => {
		it('should return false for an invalid signature', () => {
			const verification = verifyData(
				defaultData,
				makeInvalid(defaultDataSignature),
				defaultPublicKey,
			);
			expect(verification).toBe(false);
		});

		it('should return true for a valid signature', () => {
			const verification = verifyData(
				defaultData,
				defaultDataSignature,
				defaultPublicKey,
			);
			expect(verification).toBe(true);
		});
	});
});
