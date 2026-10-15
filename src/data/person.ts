/**
 * 人员数据模型
 *
 * 工号统一按字符串处理，理由是数字类型存在三种静默失败：
 *   1. 前导零丢失：`0012345` → `Number()` → `12345`，头像匹配不上且不可还原
 *   2. 非数字工号：`E00123` → `NaN`，整条记录被静默丢弃
 *   3. 超长数字：超过 Number.MAX_SAFE_INTEGER 后精度丢失，不同工号坍缩成同一个
 */

/** 参与抽奖的人员 */
export interface Person {
  /** 工号，唯一标识。归一化后的值 */
  key: string;
  /** 姓名 */
  name: string;
  /** 是否参与抽奖。false 即「排除」，取代旧版独立的 excludedUsers 数组 */
  enabled: boolean;
  /** 可参与的奖项 key。空数组表示参与全部奖项 */
  allowedPrizes: string[];
}

/** 旧版人员数据（来自构建期的 src/config/user.ts，key 为 number） */
export interface LegacyUserItem {
  key: number;
  name: string;
  allowedPrizes?: string[];
}

/** 归一化结果 */
export interface NormalizeResult {
  ok: boolean;
  /** 归一化后的工号；失败时为空字符串 */
  value: string;
  /** 原始值，供预检表格「原始值 → 归一化值」双列展示 */
  raw: string;
  /** 失败原因 */
  reason?: string;
}

/**
 * 科学计数法：Excel 把长数字工号导出时产生（如 2.20003E+15）。
 * 原始数据在此之前就已损坏，应用无法还原，只能拒绝。
 */
const SCIENTIFIC_NOTATION = /^[+-]?(\d+\.?\d*|\.\d+)[eE][+-]?\d+$/;

/**
 * 归一化工号：去掉零宽字符与全角，转半角并去除首尾空白。
 *
 * 刻意不做的事：
 *   - 不改大小写（`emp001` 与 `EMP001` 是否同一人是业务问题，不是技术问题）
 *   - 不补前导零（补几位取决于工号位数，猜错比不补更危险）
 *
 * @param raw 原始工号值，可为任意类型
 */
export function normalizeKey(raw: unknown): NormalizeResult {
  const rawText = raw === null || raw === undefined ? '' : String(raw);

  const value = rawText
    // 零宽空格/连接符、BOM、软连字符
    .replace(/[\u200B-\u200D\uFEFF\u00AD]/g, '')
    // 全角 ASCII 与符号 → 半角
    .replace(/[\uFF01-\uFF5E]/g, (ch) =>
      String.fromCharCode(ch.charCodeAt(0) - 0xfee0),
    )
    // 表意空格 → 普通空格
    .replace(/\u3000/g, ' ')
    .trim();

  if (!value) {
    return { ok: false, value: '', raw: rawText, reason: '工号为空' };
  }

  if (SCIENTIFIC_NOTATION.test(value)) {
    return {
      ok: false,
      value: '',
      raw: rawText,
      reason: `科学计数法（${value}），原始数据在导出时已损坏，无法还原`,
    };
  }

  return { ok: true, value, raw: rawText };
}

/** 将旧版（构建期、number key）人员转换为新版 Person */
export function fromLegacy(item: LegacyUserItem): Person {
  return {
    key: String(item.key),
    name: item.name,
    enabled: true,
    allowedPrizes: item.allowedPrizes ? [...item.allowedPrizes] : [],
  };
}

/** 类型守卫：区分新版 Person 与旧版 LegacyUserItem */
function isPerson(item: LegacyUserItem | Person): item is Person {
  return typeof (item as Person).key === 'string';
}

/** 将任意来源的人员记录规范为 Person，key 为 number 时自动转字符串 */
export function toPerson(item: LegacyUserItem | Person): Person {
  if (isPerson(item)) {
    return {
      key: item.key,
      name: item.name,
      enabled: item.enabled ?? true,
      allowedPrizes: item.allowedPrizes ? [...item.allowedPrizes] : [],
    };
  }
  return fromLegacy(item);
}

/**
 * 从名册中派生「被排除人员」列表
 *
 * 旧版 excludedUsers 是构建期写死的独立数组，从不落盘；
 * 现在改为从名册的 enabled 字段派生，随名册一起持久化。
 */
export function deriveExcluded(
  list: Person[],
): Array<{ key: string; name: string }> {
  return list
    .filter((p) => !p.enabled)
    .map((p) => ({ key: p.key, name: p.name }));
}

/** 按工号查找人员 */
export function findPerson(list: Person[], key: string): Person | undefined {
  return list.find((p) => p.key === key);
}

/**
 * 查找工号对应的姓名。
 * 优先取名册，名单被改动导致查不到时回退到中奖快照，保证结果页不出现空白。
 */
export function resolveName(
  list: Person[],
  key: string,
  fallback?: string,
): string {
  const person = findPerson(list, key);
  if (person) {
    return person.name;
  }
  return fallback ?? `工号 ${key}`;
}
