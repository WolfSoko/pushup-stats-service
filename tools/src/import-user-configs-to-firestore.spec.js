const fs = require('node:fs');
const {
  readConfigsFromFile,
  importUserConfigs,
} = require('./import-user-configs-to-firestore');

jest.mock('firebase-admin/app', () => ({
  initializeApp: jest.fn(),
  applicationDefault: jest.fn(),
}));

jest.mock('firebase-admin/firestore', () => ({
  getFirestore: jest.fn(),
}));

describe('readConfigsFromFile', () => {
  it('parses valid JSON from the given file path', () => {
    const configs = [{ userId: 'u1', goal: 10 }];
    jest.spyOn(fs, 'readFileSync').mockReturnValue(JSON.stringify(configs));

    const result = readConfigsFromFile('/some/path.json');

    expect(fs.readFileSync).toHaveBeenCalledWith('/some/path.json', 'utf8');
    expect(result).toEqual(configs);
  });

  it('throws if the file does not exist', () => {
    jest.spyOn(fs, 'readFileSync').mockImplementation(() => {
      throw new Error('ENOENT');
    });

    expect(() => readConfigsFromFile('/missing.json')).toThrow('ENOENT');
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });
});

describe('importUserConfigs', () => {
  let mockSet;
  let mockDoc;
  let mockCollection;
  let mockDb;

  beforeEach(() => {
    mockSet = jest.fn().mockResolvedValue(undefined);
    mockDoc = jest.fn().mockReturnValue({ set: mockSet });
    mockCollection = jest.fn().mockReturnValue({ doc: mockDoc });
    mockDb = { collection: mockCollection };
    jest.spyOn(console, 'log').mockImplementation(() => undefined);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('writes each config document to the userConfigs collection', async () => {
    const configs = [
      { userId: 'u1', goal: 10 },
      { userId: 'u2', goal: 20 },
    ];

    await importUserConfigs(mockDb, configs);

    expect(mockCollection).toHaveBeenCalledTimes(2);
    expect(mockCollection).toHaveBeenCalledWith('userConfigs');
    expect(mockDoc).toHaveBeenCalledWith('u1');
    expect(mockDoc).toHaveBeenCalledWith('u2');
    expect(mockSet).toHaveBeenCalledWith({ goal: 10 });
    expect(mockSet).toHaveBeenCalledWith({ goal: 20 });
  });

  it('logs a line per user and a completion message', async () => {
    await importUserConfigs(mockDb, [{ userId: 'u1', goal: 5 }]);

    expect(console.log).toHaveBeenCalledWith('Imported config for user: u1');
    expect(console.log).toHaveBeenCalledWith('Import complete.');
  });

  it('handles an empty configs array without errors', async () => {
    await importUserConfigs(mockDb, []);

    expect(mockCollection).not.toHaveBeenCalled();
    expect(console.log).toHaveBeenCalledWith('Import complete.');
  });

  it('excludes userId from the stored document data', async () => {
    await importUserConfigs(mockDb, [{ userId: 'u1', goal: 42, extra: 'x' }]);

    expect(mockSet).toHaveBeenCalledWith({ goal: 42, extra: 'x' });
    expect(mockSet).not.toHaveBeenCalledWith(
      expect.objectContaining({ userId: 'u1' })
    );
  });
});
