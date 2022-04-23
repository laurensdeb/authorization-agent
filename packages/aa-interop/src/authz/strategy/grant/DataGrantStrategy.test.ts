import {AccessMode} from '@laurensdeb/authorization-agent-helpers';
import {MOCK_APPLICATION, MOCK_REQUEST, MOCK_RESOURCE} from '../../../util/test/MockData';
import {DataGrantStrategy} from './DataGrantStrategy';
import {getDataGrantsForClient} from './getDataGrantsForClient';

jest.mock('./getDataGrantsForClient');

const MOCK_AA_FACTORY = {
  getAuthorizationAgent: jest.fn(),
};

const MOCK_AUTHORIZATION_AGENT = {
  findSocialAgentRegistration: jest.fn(),
  findApplicationRegistration: jest.fn(),
};

describe('A DataGrantStrategy', () => {
  const strategy = new DataGrantStrategy(MOCK_AA_FACTORY);

  beforeEach(() => {
    MOCK_AA_FACTORY.getAuthorizationAgent.mockImplementation(async () => MOCK_AUTHORIZATION_AGENT);
  });
  afterEach(() => {
    jest.resetAllMocks();
  });

  it('should authorize with read permissions when a data grant resource is fetched', async () => {
    (getDataGrantsForClient as unknown as jest.Mock).mockResolvedValueOnce([{
      iri: MOCK_RESOURCE,
    }]);
    expect(await strategy.authorize(MOCK_REQUEST, MOCK_APPLICATION)).toEqual(new Set([AccessMode.read]));

    expect(getDataGrantsForClient).toHaveBeenCalled();
    expect(getDataGrantsForClient).toHaveBeenCalledWith(MOCK_AUTHORIZATION_AGENT, MOCK_APPLICATION);
  });

  it('should not authorize with read permissions when no access grant exists', async () => {
    (getDataGrantsForClient as unknown as jest.Mock).mockResolvedValueOnce(undefined);
    expect(await strategy.authorize(MOCK_REQUEST, MOCK_APPLICATION)).toEqual(new Set());

    expect(getDataGrantsForClient).toHaveBeenCalled();
    expect(getDataGrantsForClient).toHaveBeenCalledWith(MOCK_AUTHORIZATION_AGENT, MOCK_APPLICATION);
  });
});
