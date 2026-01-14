const DB_STORE_NAME = 'AnnualRaffle.GuaranteeTransaction';
const DBVERSION = 1;
const DBNAME = 'AnnualRaffle';

let db: IDBDatabase | null = null;
let initPromise: Promise<IDBDatabase> | null = null;

interface PhotoItem {
  id?: number;
  name?: string;
  value?: string;
  createdTime?: number;
  updateTime?: number;
}

/**
 * 创建对象存储
 */
const createObjectStore = (db: IDBDatabase) => {
  const objectStore = db.createObjectStore(DB_STORE_NAME, {
    keyPath: 'id',
    autoIncrement: true
  });
  objectStore.createIndex('id', 'id', {
    unique: true
  });
  objectStore.createIndex('name', 'name');
};

/**
 * 创建或重建对象存储
 */
const createObjectStoreOrder = (db: IDBDatabase) => {
  if (!db.objectStoreNames.contains(DB_STORE_NAME)) {
    createObjectStore(db);
  } else {
    db.deleteObjectStore(DB_STORE_NAME);
    createObjectStore(db);
  }
};

/**
 * 确保数据库已初始化
 */
const ensureDatabase = (): IDBDatabase => {
  if (!db) {
    throw new Error('Database not initialized');
  }
  return db;
};

/**
 * 将 IDBRequest 包装为 Promise
 */
const promisifyRequest = <T>(request: IDBRequest<T>): Promise<T> => {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => {
      resolve(request.result);
    };
    request.onerror = (error) => {
      reject((error.target as IDBRequest).error);
    };
  });
};

class AnnualRaffleIndecDB {
  constructor() {
    this.initIndexedDB();
  }

  /**
   * 等待数据库初始化完成
   */
  private waitForReady(): Promise<IDBDatabase> {
    if (db) {
      return Promise.resolve(db);
    }
    if (initPromise) {
      return initPromise;
    }
    // 如果初始化还未开始，重新初始化
    this.initIndexedDB();
    return initPromise || Promise.reject(new Error('Failed to initialize database'));
  }

  /**
   * 初始化 IndexedDB
   */
  private initIndexedDB = (): void => {
    if (initPromise) {
      return;
    }

    initPromise = new Promise<IDBDatabase>((resolve, reject) => {
      const DBOpenRequest = window.indexedDB.open(DBNAME, DBVERSION);

      DBOpenRequest.onerror = (event) => {
        this.onerror(event);
        reject(new Error('Failed to open database'));
      };

      DBOpenRequest.onsuccess = () => {
        db = DBOpenRequest.result;
        resolve(db);
      };

      DBOpenRequest.onupgradeneeded = (event) => {
        db = (event.target as IDBOpenDBRequest).result;
        createObjectStoreOrder(db);
      };
    });
  };

  /**
   * 错误处理
   */
  onerror = (event: Event) => {
    console.error('IndexedDB connection failed:', event);
  };

  /**
   * 添加新记录到数据库
   * @param TableName 表名
   * @param newItem 新记录数据
   * @returns Promise<boolean> 是否成功
   */
  add = async (TableName: string, newItem: PhotoItem): Promise<boolean> => {
    await this.waitForReady();
    const database = ensureDatabase();
    const transaction = database.transaction([TableName], 'readwrite');
    const objectStore = transaction.objectStore(TableName);
    const addInfo = {
      createdTime: Date.now(),
      updateTime: Date.now()
    };
    await promisifyRequest(objectStore.add({ ...addInfo, ...newItem }));
    return true;
  };

  /**
   * 编辑数据库记录
   * @param TableName 表名
   * @param id 记录ID
   * @param data 要更新的数据
   * @returns Promise<boolean> 是否成功
   */
  edit = async (TableName: string, id: number, data: Partial<PhotoItem>): Promise<boolean> => {
    await this.waitForReady();
    const database = ensureDatabase();
    const transaction = database.transaction([TableName], 'readwrite');
    const objectStore = transaction.objectStore(TableName);
    
    const record = await promisifyRequest<PhotoItem>(objectStore.get(id));
    if (!record) {
      throw new Error(`Record with id ${id} not found`);
    }

    const updatedRecord = {
      ...record,
      ...data,
      updateTime: Date.now()
    };
    
    await promisifyRequest(objectStore.put(updatedRecord));
    return true;
  };

  /**
   * 删除数据库记录
   * @param TableName 表名
   * @param id 记录ID
   * @returns Promise<boolean> 是否成功
   */
  del = async (TableName: string, id: number): Promise<boolean> => {
    await this.waitForReady();
    const database = ensureDatabase();
    const transaction = database.transaction([TableName], 'readwrite');
    const objectStore = transaction.objectStore(TableName);
    await promisifyRequest(objectStore.delete(id));
    return true;
  };

  /**
   * 清空表中的所有记录
   * @param TableName 表名
   * @returns Promise<boolean> 是否成功
   */
  clear = async (TableName: string): Promise<boolean> => {
    await this.waitForReady();
    const database = ensureDatabase();
    const transaction = database.transaction([TableName], 'readwrite');
    const objectStore = transaction.objectStore(TableName);
    await promisifyRequest(objectStore.clear());
    return true;
  };

  /**
   * 获取表中记录数量
   * @param TableName 表名
   * @returns Promise<number> 记录数量
   */
  count = async (TableName: string): Promise<number> => {
    await this.waitForReady();
    const database = ensureDatabase();
    const transaction = database.transaction([TableName], 'readonly');
    const objectStore = transaction.objectStore(TableName);
    return await promisifyRequest<number>(objectStore.count());
  };

  /**
   * 根据ID获取记录
   * @param TableName 表名
   * @param id 记录ID
   * @returns Promise<PhotoItem | undefined> 记录数据
   */
  get = async (TableName: string, id: number): Promise<PhotoItem | undefined> => {
    await this.waitForReady();
    const database = ensureDatabase();
    const transaction = database.transaction([TableName], 'readonly');
    const objectStore = transaction.objectStore(TableName);
    return await promisifyRequest<PhotoItem | undefined>(objectStore.get(id));
  };

  /**
   * 根据键获取键值
   * @param TableName 表名
   * @param key 键
   * @returns Promise<IDBValidKey | undefined> 键值
   */
  getKey = async (TableName: string, key: IDBValidKey): Promise<IDBValidKey | undefined> => {
    await this.waitForReady();
    const database = ensureDatabase();
    const transaction = database.transaction([TableName], 'readonly');
    const objectStore = transaction.objectStore(TableName);
    return await promisifyRequest<IDBValidKey | undefined>(objectStore.getKey(key));
  };

  /**
   * 获取表中的所有记录
   * @param TableName 表名
   * @returns Promise<PhotoItem[]> 所有记录
   */
  getAll = async (TableName: string): Promise<PhotoItem[]> => {
    await this.waitForReady();
    const database = ensureDatabase();
    const transaction = database.transaction([TableName], 'readonly');
    const objectStore = transaction.objectStore(TableName);
    return await promisifyRequest<PhotoItem[]>(objectStore.getAll());
  };
}

const database = new AnnualRaffleIndecDB();

export { AnnualRaffleIndecDB, database, DB_STORE_NAME };
export type { PhotoItem };
