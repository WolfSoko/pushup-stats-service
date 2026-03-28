const fs = require('node:fs');
const { exportNedbUserConfigs } = require('./export-nedb-user-configs');

vi.mock('nedb-promises', () => ({
  create: vi.fn(),
}));

describe('exportNedbUserConfigs', () => {
  let mockDb;

  beforeEach(() => {
    mockDb = { find: vi.fn() };
    vi.spyOn(fs, 'writeFileSync').mockImplementation(() => undefined);
    vi.spyOn(console, 'log').mockImplementation(() => undefined);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('writes all configs as formatted JSON to the output path', async () => {
    const configs = [
      { userId: 'u1', goal: 10 },
      { userId: 'u2', goal: 20 },
    ];
    mockDb.find.mockResolvedValue(configs);

    await exportNedbUserConfigs(mockDb, '/out/export.json');

    expect(fs.writeFileSync).toHaveBeenCalledWith(
      '/out/export.json',
      JSON.stringify(configs, null, 2)
    );
  });

  it('logs the number of exported configs', async () => {
    mockDb.find.mockResolvedValue([{ userId: 'u1' }, { userId: 'u2' }]);

    await exportNedbUserConfigs(mockDb, '/out/export.json');

    expect(console.log).toHaveBeenCalledWith('Exported 2 user configs.');
  });

  it('handles an empty database without errors', async () => {
    mockDb.find.mockResolvedValue([]);

    await exportNedbUserConfigs(mockDb, '/out/export.json');

    expect(fs.writeFileSync).toHaveBeenCalledWith(
      '/out/export.json',
      JSON.stringify([], null, 2)
    );
    expect(console.log).toHaveBeenCalledWith('Exported 0 user configs.');
  });

  it('queries the database with an empty filter', async () => {
    mockDb.find.mockResolvedValue([]);

    await exportNedbUserConfigs(mockDb, '/out/export.json');

    expect(mockDb.find).toHaveBeenCalledWith({});
  });
});
