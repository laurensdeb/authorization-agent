import {AccessMode} from '@thundr-be/sai-helpers';
import {MOCK_APPLICATION, MOCK_REQUEST, MOCK_RESOURCE} from '../../../util/test/MockData';
import {DataInstanceStrategy} from './DataInstanceStrategy';
import {getDataGrantsForClient} from '../grant/getDataGrantsForClient';
import {AuthorizationAgent} from '@janeirodigital/interop-authorization-agent';
import {AllFromRegistryDataGrant, SelectedFromRegistryDataGrant} from '@janeirodigital/interop-data-model';

jest.mock('../grant/getDataGrantsForClient');

const MOCK_AUTHORIZATION_AGENT = {
  findSocialAgentRegistration: jest.fn(),
  findApplicationRegistration: jest.fn(),
};

const yieldMockDataGrant = (instances: any[]) => {
  return {
    getDataInstanceIterator: () => {
      return {
        async* [Symbol.asyncIterator]() {
          for (const instance of instances) {
            yield instance;
          }
        },
      };
    },
  };
};


const yieldMockSelectedFromRegistryDataGrant = (instances: string[], accessMode: string[]) => {
  const res = Object.create(SelectedFromRegistryDataGrant.prototype);
  Object.defineProperty(res, 'hasDataInstance', {value: instances});
  Object.defineProperty(res, 'accessMode', {value: accessMode});
  return res;
};

const yieldMockAllFromRegistryDataGrant = (instances: string[], accessMode: string[]) => {
  const res = Object.create(AllFromRegistryDataGrant.prototype);
  Object.defineProperty(res, 'accessMode', {value: accessMode});
  Object.defineProperty(res, 'hasDataRegistration', {value: undefined});
  Object.defineProperty(res, 'factory', {value: {
    readable: {
      dataRegistration: () => {
        return {
          contains: instances,
        };
      },
    },
  }});
  return res;
};

describe('A DataInstanceStrategy', () => {
  const strategy = new DataInstanceStrategy();

  afterEach(() => {
    jest.resetAllMocks();
  });

  it('should authorize with permissions of grant when a data instance is fetched', async () => {
    (getDataGrantsForClient as unknown as jest.Mock).mockResolvedValueOnce([
      yieldMockDataGrant([{iri: MOCK_RESOURCE, accessMode: [AccessMode.read, AccessMode.write]}]),
    ]);
    expect(await strategy.authorize((MOCK_AUTHORIZATION_AGENT as unknown as AuthorizationAgent),
        MOCK_REQUEST, MOCK_APPLICATION)).toEqual(new Set([AccessMode.read]));

    expect(getDataGrantsForClient).toHaveBeenCalled();
    expect(getDataGrantsForClient).toHaveBeenCalledWith(MOCK_AUTHORIZATION_AGENT, MOCK_APPLICATION);
  });

  it('should authorize with permissions of selected from registry grant when a data instance is fetched', async () => {
    (getDataGrantsForClient as unknown as jest.Mock).mockResolvedValueOnce([
      yieldMockSelectedFromRegistryDataGrant([MOCK_RESOURCE], [AccessMode.read, AccessMode.write]),
    ]);
    expect(await strategy.authorize((MOCK_AUTHORIZATION_AGENT as unknown as AuthorizationAgent),
        MOCK_REQUEST, MOCK_APPLICATION)).toEqual(new Set([AccessMode.read]));

    expect(getDataGrantsForClient).toHaveBeenCalled();
    expect(getDataGrantsForClient).toHaveBeenCalledWith(MOCK_AUTHORIZATION_AGENT, MOCK_APPLICATION);
  });

  it('should authorize with permissions of all from registry grant when a data instance is fetched', async () => {
    (getDataGrantsForClient as unknown as jest.Mock).mockResolvedValueOnce([
      yieldMockAllFromRegistryDataGrant([MOCK_RESOURCE], [AccessMode.read, AccessMode.write]),
    ]);
    expect(await strategy.authorize((MOCK_AUTHORIZATION_AGENT as unknown as AuthorizationAgent),
        MOCK_REQUEST, MOCK_APPLICATION)).toEqual(new Set([AccessMode.read]));

    expect(getDataGrantsForClient).toHaveBeenCalled();
    expect(getDataGrantsForClient).toHaveBeenCalledWith(MOCK_AUTHORIZATION_AGENT, MOCK_APPLICATION);
  });

  it('should ignore additional modes from the interoperability specification', async () => {
    (getDataGrantsForClient as unknown as jest.Mock).mockResolvedValueOnce([
      yieldMockDataGrant([{iri: MOCK_RESOURCE, accessMode: [AccessMode.read, AccessMode.write, 'http://www.w3.org/ns/auth/acl#Update']}]),
    ]);
    expect(await strategy.authorize((MOCK_AUTHORIZATION_AGENT as unknown as AuthorizationAgent),
        MOCK_REQUEST, MOCK_APPLICATION)).toEqual(new Set([AccessMode.read]));

    expect(getDataGrantsForClient).toHaveBeenCalled();
    expect(getDataGrantsForClient).toHaveBeenCalledWith(MOCK_AUTHORIZATION_AGENT, MOCK_APPLICATION);
  });

  it('should not authorize when instance iri differs', async () => {
    (getDataGrantsForClient as unknown as jest.Mock).mockResolvedValueOnce([
      yieldMockDataGrant([{iri: 'https://pod.example.org/bob/123', accessMode: [AccessMode.read, AccessMode.write]}]),
    ]);
    expect(await strategy.authorize((MOCK_AUTHORIZATION_AGENT as unknown as AuthorizationAgent),
        MOCK_REQUEST, MOCK_APPLICATION)).toEqual(new Set([]));

    expect(getDataGrantsForClient).toHaveBeenCalled();
    expect(getDataGrantsForClient).toHaveBeenCalledWith(MOCK_AUTHORIZATION_AGENT, MOCK_APPLICATION);
  });

  it('should not authorize when no data grants exist', async () => {
    (getDataGrantsForClient as unknown as jest.Mock).mockResolvedValueOnce([]);
    expect(await strategy.authorize((MOCK_AUTHORIZATION_AGENT as unknown as AuthorizationAgent),
        MOCK_REQUEST, MOCK_APPLICATION)).toEqual(new Set([]));

    expect(getDataGrantsForClient).toHaveBeenCalled();
    expect(getDataGrantsForClient).toHaveBeenCalledWith(MOCK_AUTHORIZATION_AGENT, MOCK_APPLICATION);
  });

  it('should not authorize when no access grant exist', async () => {
    (getDataGrantsForClient as unknown as jest.Mock).mockResolvedValueOnce(undefined);
    expect(await strategy.authorize((MOCK_AUTHORIZATION_AGENT as unknown as AuthorizationAgent),
        MOCK_REQUEST, MOCK_APPLICATION)).toEqual(new Set([]));

    expect(getDataGrantsForClient).toHaveBeenCalled();
    expect(getDataGrantsForClient).toHaveBeenCalledWith(MOCK_AUTHORIZATION_AGENT, MOCK_APPLICATION);
  });
});
