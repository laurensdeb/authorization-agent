/* eslint-disable require-jsdoc */
/* eslint-disable valid-jsdoc */
import {Authorizer, getLoggerFor, ResourceSet,
  NotFoundHttpError, ForbiddenHttpError, ResourceIdentifier} from '@solid/community-server';
import {UnauthorizedHttpError} from './error/UnauthorizedHttpError';
import type {CredentialSet} from '../authentication/Credentials';
import type {PermissionSet} from './permissions/Permissions';
import {AccessMode} from './permissions/Permissions';

export interface AuthorizerInput {
  /**
   * Credentials of the entity that wants to use the resource.
   */
  credentials: CredentialSet;
  /**
   * Identifier of the resource that will be read/modified.
   */
  identifier: ResourceIdentifier;
  /**
   * Modes that are requested on the resource.
   */
  modes: Set<AccessMode>;
  /**
   * Permissions that are available for the request.
   */
  permissionSet: PermissionSet;
}

/**
 * Authorizer that bases its decision on the output it gets from its PermissionReader.
 * For each permission it checks if the reader allows that for at least one credential type,
 * if yes authorization is granted.
 * `undefined` values for reader results are interpreted as `false`.
 */
export class UmaPermissionBasedAuthorizer extends Authorizer {
  protected readonly logger = getLoggerFor(this);

  private readonly resourceSet: ResourceSet;

  /**
   * The existence of the target resource determines the output status code for certain situations.
   * The provided {@link ResourceSet} will be used for that.
   * @param resourceSet - {@link ResourceSet} that can verify the target resource existence.
   */
  public constructor(resourceSet: ResourceSet) {
    super();
    this.resourceSet = resourceSet;
  }

  public async handle(input: AuthorizerInput): Promise<void> {
    const {credentials, modes, identifier, permissionSet} = input;

    const modeString = [...modes].join(',');
    this.logger.debug(`Checking if ${this.getAgentWebId(credentials)} has ${modeString} ` +
    `permissions for ${identifier.path}`);

    // Ensure all required modes are within the agent's permissions.
    for (const mode of modes) {
      try {
        this.requireModePermission(credentials, permissionSet, {mode, modes}, identifier.path);
      } catch (error: unknown) {
        // If we know the operation will return a 404 regardless (= resource does not exist and is not being created),
        // and the agent is allowed to know about its existence (= the agent has Read permissions),
        // then immediately send the 404 here, as it makes any other agent permissions irrelevant.
        const exposeExistence = this.hasModePermission(permissionSet, AccessMode.read);
        if (exposeExistence && !modes.has(AccessMode.create) && !await this.resourceSet.hasResource(identifier)) {
          throw new NotFoundHttpError();
        }
        // Otherwise, deny access based on existing grounds.
        throw error;
      }
    }
    this.logger.debug(`${JSON.stringify(credentials)} has ${modeString} permissions for ${identifier.path}`);
  }

  /**
   * Ensures that at least one of the credentials provides permissions for the given mode.
   * Throws a {@link ForbiddenHttpError} or {@link UnauthorizedHttpError} depending on the credentials
   * if access is not allowed.
   * @param credentials - Credentials that require access.
   * @param permissionSet - PermissionSet describing the available permissions of the credentials.
   * @param mode - Which mode is requested.
   */
  private requireModePermission(credentials: CredentialSet, permissionSet: PermissionSet,
      mode: {mode: AccessMode, modes: Set<AccessMode>}, path: string): void {
    if (!this.hasModePermission(permissionSet, mode.mode)) {
      if (this.isAuthenticated(credentials)) {
        this.logger.warn(`Agent ${this.getAgentWebId(credentials)} has no ${mode.mode} permissions`);
        throw new ForbiddenHttpError();
      } else {
        // Solid, §2.1: "When a client does not provide valid credentials when requesting a resource that requires it,
        // the data pod MUST send a response with a 401 status code (unless 404 is preferred for security reasons)."
        // https://solid.github.io/specification/protocol#http-server
        this.logger.warn(`Unauthenticated agent has no ${mode.mode} permissions`);
        throw new UnauthorizedHttpError([...mode.modes], path);
      }
    }
  }

  private getAgentWebId(credentials: CredentialSet) {
    if (credentials.ticket) {
      return credentials.ticket.webId;
    }
    return credentials.agent?.webId;
  }

  /**
   * Checks if one of the Permissions in the PermissionSet grants permission to use the given mode.
   */
  private hasModePermission(permissionSet: PermissionSet, mode: AccessMode): boolean {
    for (const permissions of Object.values(permissionSet)) {
      if (permissions[mode]) {
        return true;
      }
    }
    return false;
  }

  /**
   * Checks whether the agent is authenticated (logged in) or not (public/anonymous).
   * @param credentials - Credentials to check.
   */
  private isAuthenticated(credentials: CredentialSet): boolean {
    return !!(credentials.agent && credentials.agent.webId) || !!(credentials.ticket && credentials.ticket.webId);
  }
}
