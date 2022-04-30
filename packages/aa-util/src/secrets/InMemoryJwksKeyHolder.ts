import {exportJWK, generateKeyPair, JSONWebKeySet, JWK, KeyLike} from 'jose';
import {JwksKeyHolder} from './JwksKeyHolder';
import {v4} from 'uuid';
import {getLoggerFor, Logger} from '../logging/LoggerUtils';

const SUPPORTED_ALGORITHMS = new Set(['ES256', 'ES384', 'ES512', 'RS256', 'RS384', 'RS512']);

export interface KeyPair {
  privateKey: KeyLike,
  publicKey: KeyLike
}

/**
 * In-memory implementation of a JWKS Key Holder.
 */
export class InMemoryJwksKeyHolder extends JwksKeyHolder {
  protected readonly logger: Logger = getLoggerFor(this);
  private readonly keys: Map<string, KeyPair>;
  private currentKid: undefined | string;

  /**
   * Yields a new instance of the InMemoryKeyholder
   * @param {string} alg Algorithm to be used for key generation
   */
  public constructor(private readonly alg: string) {
    super();
    if (!SUPPORTED_ALGORITHMS.has(alg)) {
      const msg = `The chosen algorithm '${alg}' is not supported by the InMemoryJwksKeyHolder.`;
      this.logger.error(msg);
      throw new Error(msg);
    }

    this.alg = alg;
    this.keys = new Map();
  }

  /**
   * Get algorithm used by keyholder.
   *
   * @return {string} - algorithm
   */
  getAlg(): string {
    return this.alg;
  }

  /**
   * Get all key identifiers in holder
   * @return {string[]}
   */
  getKids(): string[] {
    return [...this.keys.keys()];
  }

  /**
   * Get default private key
   * @return {string} - default kid
   */
  async getDefaultKey(): Promise<string> {
    if (!this.currentKid) {
      await this.generateKeypair();
    }
    return this.currentKid!;
  }

  /**
   * Retrieves private key for kid
   * @param {string} kid - key identfier
   * @return {KeyLike}
   */
  getPrivateKey(kid: string): KeyLike {
    if (!this.keys.has(kid)) {
      const msg = `The specified kid '${kid}' does not exist in the holder.`;
      this.logger.error(msg);
      throw new Error(msg);
    }
    this.logger.info(`Retrieved private key with kid '${kid}'.`);
    return this.keys.get(kid)!.privateKey;
  }

  /**
   * Retrieves public key for kid
   * @param {string} kid - key identfier
   * @return {KeyLike}
   */
  getPublicKey(kid: string): KeyLike {
    if (!this.keys.has(kid)) {
      const msg = `The specified kid '${kid}' does not exist in the holder.`;
      this.logger.error(msg);
      throw new Error(msg);
    }
    this.logger.info(`Retrieved public key with kid '${kid}'.`);
    return this.keys.get(kid)!.publicKey;
  }

  /**
   * Get the JWK of the Public Key for some kid.
   * @param {string} kid key identifier
   * @return {Promise<JWK>} the JWK of the public key.
   */
  async toPublicJwk(kid: string): Promise<JWK> {
    if (!this.keys.has(kid)) {
      const msg = `The specified kid '${kid}' does not exist in the holder.`;
      this.logger.error(msg);
      throw new Error(msg);
    }
    return {kid: kid, ...await exportJWK(this.keys.get(kid)!.publicKey)};
  }

  /**
   * Yields the JSON Web Key Set for the keys in this Holder.
   * @return {Promise<JSONWebKeySet>} JWKS
   */
  async getJwks(): Promise<JSONWebKeySet> {
    return {keys: await Promise.all(this.getKids().map((kid) => this.toPublicJwk(kid)))};
  }

  /**
   * Generates a new keypair and yields its kid
   * @return {string} key id
   */
  async generateKeypair(): Promise<string> {
    const key = await generateKeyPair(this.alg);
    const kid = v4();

    this.keys.set(kid, key);
    this.logger.info(`Generated new default keypair with kid '${kid}'`);
    this.currentKid = kid;
    return kid;
  }
}

