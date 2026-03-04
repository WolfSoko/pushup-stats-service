import { PushupDbService } from './pushup-db.service';

const setMock = jest.fn();
const getMock = jest.fn();
const deleteMock = jest.fn();
const docMock = jest.fn();
const orderByGetMock = jest.fn();
const orderByMock = jest.fn();
const collectionMock = jest.fn();
const getAppsMock = jest.fn();
const initializeAppMock = jest.fn();
const applicationDefaultMock = jest.fn();

jest.mock('firebase-admin/app', () => ({
  getApps: () => getAppsMock(),
  initializeApp: (...args: unknown[]) => initializeAppMock(...args),
  applicationDefault: (...args: unknown[]) => applicationDefaultMock(...args),
}));

jest.mock('firebase-admin/firestore', () => ({
  getFirestore: () => ({
    collection: (...args: unknown[]) => collectionMock(...args),
  }),
}));

describe('PushupDbService (Firestore)', () => {
  beforeEach(() => {
    jest.restoreAllMocks();
    jest.clearAllMocks();

    orderByMock.mockReturnValue({ get: orderByGetMock });
    collectionMock.mockReturnValue({ orderBy: orderByMock, doc: docMock });
    getAppsMock.mockReturnValue([]);
    applicationDefaultMock.mockReturnValue('adc');
  });

  it('initializes firebase app once', () => {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const svc = new PushupDbService();
    expect(initializeAppMock).toHaveBeenCalledTimes(1);
  });

  it('findAll maps firestore docs', async () => {
    orderByGetMock.mockResolvedValue({
      docs: [
        {
          id: 'a',
          data: () => ({
            timestamp: '2026-03-01T10:00',
            reps: 10,
            source: 'web',
          }),
        },
      ],
    });

    const svc = new PushupDbService();
    const out = await svc.findAll();

    expect(collectionMock).toHaveBeenCalledWith('pushups');
    expect(orderByMock).toHaveBeenCalledWith('timestamp', 'asc');
    expect(out).toEqual([
      {
        _id: 'a',
        userId: 'default',
        timestamp: '2026-03-01T10:00',
        reps: 10,
        source: 'web',
        type: 'Standard',
      },
    ]);
  });

  it('create writes document with defaults', async () => {
    docMock.mockReturnValue({ id: 'new1', set: setMock });

    const svc = new PushupDbService();
    const out = await svc.create({ timestamp: 't', reps: 12, source: 'api' });

    expect(setMock).toHaveBeenCalled();
    expect(out._id).toBe('new1');
    expect(out.type).toBe('Standard');
    expect(out.userId).toBe('default');
  });

  it('update returns null when not found', async () => {
    docMock.mockReturnValue({ get: getMock });
    getMock.mockResolvedValue({ exists: false });

    const svc = new PushupDbService();
    await expect(svc.update('id', { reps: 1 })).resolves.toBeNull();
  });

  it('remove deletes existing document', async () => {
    docMock.mockReturnValue({ get: getMock, delete: deleteMock });
    getMock.mockResolvedValue({ exists: true });

    const svc = new PushupDbService();
    await expect(svc.remove('id')).resolves.toBe(1);
    expect(deleteMock).toHaveBeenCalled();
  });
});
