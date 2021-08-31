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
 */
import * as WebSocket from 'ws';
import { Logger } from '../../logger';
import { NotificationRequest, RequestObject } from '../jsonrpc';

interface WebSocketWithTracking extends WebSocket {
	isAlive?: boolean;
}

export type WSMessageHandler = (socket: WebSocketWithTracking, message: string) => void;

export class WSServer {
	public server!: WebSocket.Server;

	private pingTimer!: NodeJS.Timeout;
	private readonly port: number;
	private readonly host?: string;
	private readonly path: string;
	private readonly logger: Logger;
	// subscription holds url: event names array
	private readonly _subscriptions: Record<string, Set<string>> = {};

	public constructor(options: { port: number; host?: string; path: string; logger: Logger }) {
		this.port = options.port;
		this.host = options.host;
		this.path = options.path;
		this.logger = options.logger;
	}

	public start(messageHandler: WSMessageHandler): WebSocket.Server {
		this.server = new WebSocket.Server({
			path: this.path,
			port: this.port,
			host: this.host,
			clientTracking: true,
		});
		this.server.on('connection', socket => this._handleConnection(socket, messageHandler));
		this.server.on('error', error => {
			this.logger.error(error);
		});
		this.server.on('listening', () => {
			this.logger.info({ host: this.host, port: this.port, path: this.path }, 'Websocket Server Ready');
		});

		this.server.on('close', () => {
			clearInterval(this.pingTimer);
		});

		this.pingTimer = this._setUpPing();

		return this.server;
	}

	public stop(): void {
		if (this.server) {
			this.server.close();
		}
	}

	public broadcast(message: NotificationRequest): void {
		for (const client of this.server.clients) {
			if (client.readyState === WebSocket.OPEN) {
				const subscription = this._subscriptions[client.url]
				if (!subscription) {
					continue;
				}
				if (Array.from(subscription).some(key => message.method.includes(key))) {
					client.send(JSON.stringify(message));
				}
			}
		}
	}

	private _handleConnection(socket: WebSocketWithTracking, messageHandler: WSMessageHandler) {
		// eslint-disable-next-line no-param-reassign
		socket.isAlive = true;
		socket.on('message', (message: string) => {
			// Read the message, and if it's subscription message, handle here
			try {
				const parsedMessage = JSON.parse(message) as RequestObject;
				if (parsedMessage.method === 'subscribe') {
					this._handleSubscription(socket, parsedMessage);
					return;
				}
				if (parsedMessage.method === 'unsubscribe') {
					this._handleUnsubscription(socket, parsedMessage);
					return;
				}
			} catch (error) {
				this.logger.error({ err: (error as Error) }, 'Received invalid websocket message');
				return;
			}
			messageHandler(socket, message);
		});
		socket.on('pong', () => this._handleHeartbeat(socket));
		socket.on('close', () => {
			delete this._subscriptions[socket.url];
		})
		this.logger.info('New web socket client connected');
	}

	private _handleHeartbeat(socket: WebSocketWithTracking) {
		// eslint-disable-next-line no-param-reassign
		socket.isAlive = true;
	}

	private _setUpPing() {
		return setInterval(() => {
			for (const socket of this.server.clients) {
				const aClient = socket as WebSocketWithTracking;
				if (aClient.isAlive === false) {
					return socket.terminate();
				}

				aClient.isAlive = false;
				// eslint-disable-next-line @typescript-eslint/no-empty-function
				aClient.ping(() => {});
			}
			return null;
		}, 3000);
	}

	private _handleSubscription(socket: WebSocketWithTracking, message: Partial<RequestObject>) {
		const { params } = message;
		if (!params || !Array.isArray(params.topics) || !params.topics.length) {
			throw new Error('Invalid subscription message.');
		}
		if (!this._subscriptions[socket.url]) {
			this._subscriptions[socket.url] = new Set<string>();
		}
		for (const eventName of params.topics) {
			this._subscriptions[socket.url].add(eventName);
		}
	}

	private _handleUnsubscription(socket: WebSocketWithTracking, message: Partial<RequestObject>) {
		const { params } = message;
		if (!params || !Array.isArray(params.topics) || !params.topics.length) {
			throw new Error('Invalid subscription message.');
		}
		if (!this._subscriptions[socket.url]) {
			return;
		}
		for (const eventName of params.topics) {
			this._subscriptions[socket.url].delete(eventName);
		}
	}
}
