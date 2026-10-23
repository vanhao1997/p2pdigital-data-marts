import i18n from '../../../i18n';
import {
  ACRONYM_TOKENS,
  FIELD_DICTIONARY_VI,
  TOKEN_DICTIONARY_VI,
} from './field-dictionary-vi';

export type HumanizeLocale = 'vi' | 'en';

export interface HumanizeFieldOptions {
  /** Target locale. Defaults to active i18n language ('vi' or 'en'). */
  locale?: HumanizeLocale;
  /** Append `(technical_name)` when the humanized label differs from the input. */
  includeTechnicalName?: boolean;
  /** For dotted paths (`a.b.c`), only humanize the leaf segment (`c`). */
  leafOnly?: boolean;
}

export function resolveHumanizeLocale(locale?: string): HumanizeLocale {
  if (locale === 'vi' || locale?.startsWith('vi')) return 'vi';
  if (locale === 'en' || locale?.startsWith('en')) return 'en';
  const active = i18n.resolvedLanguage ?? i18n.language;
  return active === 'vi' || active.startsWith('vi') ? 'vi' : 'en';
}

export function isVietnameseLocale(locale?: string): boolean {
  return resolveHumanizeLocale(locale) === 'vi';
}

/**
  * Normalizes a string for accent-insensitive search (strips Vietnamese diacritics and `đ`).
 */
export function normalizeSearchText(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/[_\-./]+/g, ' ')
    .replace(/\s+/g, ' ');
}

/**
 * Splits a technical identifier (`snake_case`, `kebab-case`, `camelCase`, `PascalCase`)
 * into lowercase word tokens.
 */
export function tokenizeFieldName(raw: string): string[] {
  const trimmed = raw.trim().replace(/^[_\-./]+|[_\-./]+$/g, '');
  if (!trimmed) return [];

  const withBoundaries = trimmed
    .replace(/([a-z0-9])([A-Z])/g, '$1_$2')
    .replace(/([A-Z]+)([A-Z][a-z])/g, '$1_$2');

  return withBoundaries
    .split(/[_\-/\s]+/)
    .map(token => token.trim().toLowerCase())
    .filter(Boolean);
}

function capitalizeFirst(value: string): string {
  if (!value) return value;
  return value.charAt(0).toUpperCase() + value.slice(1);
}

function lowerFirstUnlessAcronym(phrase: string): string {
  if (!phrase) return phrase;
  const firstWord = (phrase.split(/\s+/)[0] ?? '').replace(/[(),]/g, '');
  if (
    (firstWord.length > 1 && firstWord === firstWord.toUpperCase()) ||
    /^(Facebook|Google|TikTok|LinkedIn|Instagram|Reddit|Shopify|GitHub|Admicro|Criteo|MyShopify|Gravatar|Open|Android|iOS|Canvas|Messenger|Pixel|SKAdNetwork|Wiki)$/.test(
      firstWord
    )
  ) {
    return phrase;
  }
  return phrase.charAt(0).toLowerCase() + phrase.slice(1);
}

function formatEnglishToken(token: string): string {
  const lower = token.toLowerCase();
  if (ACRONYM_TOKENS.has(lower)) {
    return lower.toUpperCase();
  }
  return capitalizeFirst(lower);
}

function humanizeTokensEn(tokens: readonly string[]): string {
  return tokens.map(formatEnglishToken).join(' ');
}

/**
 * Multi-token English collocations collapsed into a single pre-translated Vietnamese phrase token
 * (stored with `~` prefix) before structural Vietnamese composition runs.
 */
const COLLOCATIONS_VI: readonly (readonly [readonly string[], string])[] = [
  [['return', 'on', 'ad', 'spend'], 'ROAS'],
  [['cost', 'of', 'advertiser', 'value'], 'tỷ lệ chi phí trên giá trị nhà quảng cáo'],
  [['click', 'through', 'rate'], 'CTR'],
  [['in', 'reply', 'to'], 'phản hồi cho'],
  [['call', 'to', 'action'], 'nút kêu gọi hành động (CTA)'],
  [['top', 'of', 'page'], 'đầu trang'],
  [['time', 'of', 'day'], 'khung giờ trong ngày'],
  [['day', 'of', 'week'], 'ngày trong tuần'],
  [['country', 'code', 'of', 'origin'], 'mã quốc gia xuất xứ'],
  [['end', 'of', 'campaign'], 'kết thúc chiến dịch'],
  [['ad', 'group'], 'nhóm quảng cáo'],
  [['ad', 'groups'], 'nhóm quảng cáo'],
  [['ad', 'set'], 'nhóm quảng cáo'],
  [['ad', 'sets'], 'nhóm quảng cáo'],
  [['campaign', 'group'], 'nhóm chiến dịch'],
  [['campaign', 'groups'], 'nhóm chiến dịch'],
  [['landing', 'page'], 'trang đích'],
  [['landing', 'pages'], 'trang đích'],
  [['company', 'page'], 'trang công ty'],
  [['external', 'website'], 'trang web bên ngoài'],
  [['post', 'click'], 'sau nhấp chuột'],
  [['post', 'view'], 'sau lượt xem'],
  [['view', 'through'], 'sau lượt xem'],
  [['click', 'through'], 'nhấp chuột'],
  [['one', 'click'], 'một chạm'],
  [['full', 'screen'], 'toàn màn hình'],
  [['real', 'time'], 'thời gian thực'],
  [['first', 'quartile'], '25% thời lượng'],
  [['third', 'quartile'], '75% thời lượng'],
  [['lead', 'form'], 'biểu mẫu khách hàng tiềm năng'],
  [['lead', 'generation'], 'thu thập khách hàng tiềm năng'],
  [['lead', 'gen'], 'thu thập khách hàng tiềm năng'],
  [['job', 'apply'], 'ứng tuyển việc làm'],
  [['job', 'applications'], 'đơn ứng tuyển việc làm'],
  [['job', 'application'], 'đơn ứng tuyển việc làm'],
  [['line', 'items'], 'hạng mục quảng cáo'],
  [['line', 'item'], 'hạng mục quảng cáo'],
  [['geo', 'target'], 'mục tiêu địa lý'],
  [['conversion', 'rate'], 'tỷ lệ chuyển đổi'],
  [['engagement', 'rate'], 'tỷ lệ tương tác'],
  [['bounce', 'rate'], 'tỷ lệ thoát'],
  [['click', 'rate'], 'tỷ lệ nhấp'],
  [['view', 'rate'], 'tỷ lệ xem'],
  [['impression', 'share'], 'tỷ lệ hiển thị'],
  [['upper', 'bound'], 'cận trên'],
  [['lower', 'bound'], 'cận dưới'],
  [['local', 'currency'], 'tiền tệ địa phương'],
  [['local', 'micro'], 'tiền tệ địa phương (micro)'],
  [['client', 'attribution'], 'theo phân bổ khách hàng'],
  [['e', 'cos'], 'ECOS'],
  [['screen', 'name'], 'tên hiển thị'],
  [['first', 'name'], 'tên'],
  [['last', 'name'], 'họ'],
  [['full', 'name'], 'họ và tên'],
  [['user', 'name'], 'tên người dùng'],
  [['host', 'name'], 'tên máy chủ (Host)'],
  [['first', 'page'], 'trang đầu'],
  [['first', 'position'], 'vị trí đầu'],
  [['brand', 'safety'], 'an toàn thương hiệu'],
  [['brand', 'lift'], 'mức tăng trưởng thương hiệu'],
  [['app', 'store'], 'cửa hàng ứng dụng'],
  [['google', 'play'], 'Google Play'],
  [['funding', 'instrument'], 'phương thức thanh toán'],
  [['custom', 'audience'], 'đối tượng tùy chỉnh'],
  [['custom', 'audiences'], 'đối tượng tùy chỉnh'],
  [['operating', 'system'], 'hệ điều hành'],
  [['operating', 'systems'], 'hệ điều hành'],
  [['ip', 'address'], 'địa chỉ IP'],
  [['email', 'address'], 'địa chỉ email'],
  [['billing', 'address'], 'địa chỉ thanh toán'],
  [['shipping', 'address'], 'địa chỉ giao hàng'],
  [['default', 'address'], 'địa chỉ mặc định'],
  [['contact', 'info'], 'thông tin liên hệ'],
  [['staff', 'count'], 'quy mô nhân sự'],
  [['follower', 'counts'], 'số lượng người theo dõi'],
  [['follower', 'count'], 'số lượng người theo dõi'],
  [['follower', 'gain'], 'lượt tăng người theo dõi'],
  [['sign', 'up'], 'đăng ký'],
  [['add', 'to', 'wishlist'], 'thêm vào danh sách yêu thích'],
  [['add', 'to', 'cart'], 'thêm vào giỏ hàng'],
  [['smart', 'performance'], 'hiệu suất thông minh'],
  [['advanced', 'dedicated'], 'chuyên biệt nâng cao'],
  [['10', 'second'], '10 giây'],
  [['15', 'second'], '15 giây'],
  [['30', 'second'], '30 giây'],
  [['2', 'sec'], '2 giây'],
  [['6', 'sec'], '6 giây'],
  [['10', 'sec'], '10 giây'],
  [['15', 'sec'], '15 giây'],
  [['30', 'sec'], '30 giây'],
];

function collapseCollocationsVi(tokens: readonly string[]): string[] {
  const result: string[] = [];
  let i = 0;
  while (i < tokens.length) {
    let matched = false;
    for (const [pattern, replacement] of COLLOCATIONS_VI) {
      if (i + pattern.length <= tokens.length) {
        let ok = true;
        for (let j = 0; j < pattern.length; j++) {
          if (tokens[i + j] !== pattern[j]) {
            ok = false;
            break;
          }
        }
        if (ok) {
          result.push(`~${replacement}`);
          i += pattern.length;
          matched = true;
          break;
        }
      }
    }
    if (!matched) {
      result.push(tokens[i]);
      i += 1;
    }
  }
  return result;
}

const TRAILING_QUALIFIERS_VI: Readonly<Record<string, string>> = {
  pc1d: '1 ngày sau nhấp',
  pc7d: '7 ngày sau nhấp',
  pc30d: '30 ngày sau nhấp',
  pv1d: '1 ngày sau xem',
  pv24h: '24 giờ sau xem',
  micros: 'micro',
  micro: 'micro',
  p25: '25% thời lượng',
  p50: '50% thời lượng',
  p75: '75% thời lượng',
  p95: '95% thời lượng',
  p100: '100% thời lượng',
  at25: 'mốc 25%',
  at50: 'mốc 50%',
  at75: 'mốc 75%',
  '2s': '2 giây',
  '6s': '6 giây',
  '10s': '10 giây',
  '15s': '15 giây',
  '30s': '30 giây',
  '60s': '60 giây',
  v2: 'v2',
};

const HEAD_NOUN_SUFFIX_VI: Readonly<Record<string, string>> = {
  id: 'ID',
  ids: 'Danh sách ID',
  urn: 'Định danh URN',
  identifier: 'Mã định danh',
  name: 'Tên',
  code: 'Mã',
  codes: 'Mã',
  key: 'Khóa',
  type: 'Loại',
  types: 'Loại',
  status: 'Trạng thái',
  statuses: 'Trạng thái',
  state: 'Trạng thái',
  count: 'Số lượng',
  counts: 'Số lượng',
  rate: 'Tỷ lệ',
  ratio: 'Tỷ lệ',
  percent: 'Tỷ lệ phần trăm',
  percentage: 'Tỷ lệ phần trăm',
  date: 'Ngày',
  at: 'Thời điểm',
  time: 'Thời gian',
  timestamp: 'Dấu thời gian',
  url: 'URL',
  urls: 'URL',
  uri: 'URI',
  link: 'Liên kết',
  links: 'Liên kết',
  amount: 'Số tiền',
  cost: 'Chi phí',
  spend: 'Chi phí',
  price: 'Giá',
  fee: 'Phí',
  charge: 'Phí',
  value: 'Giá trị',
  values: 'Giá trị',
  revenue: 'Doanh thu',
  sales: 'Doanh số',
  budget: 'Ngân sách',
  bid: 'Giá thầu',
  clicks: 'Lượt nhấp',
  click: 'Lượt nhấp',
  impressions: 'Lượt hiển thị',
  impression: 'Lượt hiển thị',
  views: 'Lượt xem',
  view: 'Lượt xem',
  conversions: 'Lượt chuyển đổi',
  conversion: 'Lượt chuyển đổi',
  engagements: 'Lượt tương tác',
  engagement: 'Lượt tương tác',
  completions: 'Lượt hoàn tất',
  completion: 'Lượt hoàn tất',
  starts: 'Lượt bắt đầu',
  plays: 'Lượt phát',
  opens: 'Lượt mở',
  likes: 'Lượt thích',
  comments: 'Bình luận',
  follows: 'Lượt theo dõi',
  unfollows: 'Lượt bỏ theo dõi',
  shares: 'Lượt chia sẻ',
  registrations: 'Lượt đăng ký',
  applications: 'Đơn đăng ký',
  leads: 'Khách hàng tiềm năng',
  lead: 'Khách hàng tiềm năng',
  purchases: 'Lượt mua hàng',
  purchase: 'Lượt mua hàng',
  orders: 'Đơn hàng',
  order: 'Đơn hàng',
  roas: 'ROAS',
  roi: 'ROI',
  cpc: 'CPC',
  cpm: 'CPM',
  cpp: 'CPP',
  cpa: 'CPA',
  cpv: 'CPV',
  cpi: 'CPI',
  cps: 'CPS',
  cpo: 'CPO',
  ctr: 'CTR',
  cvr: 'CVR',
  ecpm: 'eCPM',
  ecpa: 'eCPA',
  window: 'Khung thời gian',
  cap: 'Giới hạn',
  limit: 'Giới hạn',
  score: 'Điểm',
  rank: 'Thứ hạng',
  ranking: 'Xếp hạng',
  level: 'Cấp độ',
  levels: 'Cấp độ',
  mode: 'Chế độ',
  method: 'Phương thức',
  strategy: 'Chiến lược',
  policy: 'Chính sách',
  settings: 'Cài đặt',
  setting: 'Cài đặt',
  config: 'Cấu hình',
  spec: 'Đặc tả',
  specs: 'Đặc tả',
  info: 'Thông tin',
  details: 'Chi tiết',
  detail: 'Chi tiết',
  report: 'Báo cáo',
  reports: 'Báo cáo',
  stats: 'Thống kê',
  statistics: 'Thống kê',
  insights: 'Báo cáo hiệu quả',
  insight: 'Báo cáo hiệu quả',
  breakdown: 'Phân tích chi tiết',
  category: 'Danh mục',
  categories: 'Danh mục',
  group: 'Nhóm',
  groups: 'Nhóm',
  list: 'Danh sách',
  range: 'Phạm vi',
  ranges: 'Phạm vi',
  number: 'Số',
  num: 'Số lượng',
  duration: 'Thời lượng',
  text: 'Văn bản',
  texts: 'Văn bản',
  title: 'Tiêu đề',
  description: 'Mô tả',
  reason: 'Lý do',
  reasons: 'Lý do',
  feedback: 'Phản hồi',
  location: 'Vị trí',
  locations: 'Vị trí',
  address: 'Địa chỉ',
  province: 'Tỉnh/Thành phố',
  country: 'Quốc gia',
  city: 'Thành phố',
  region: 'Khu vực',
  timezone: 'Múi giờ',
  currency: 'Tiền tệ',
  language: 'Ngôn ngữ',
  languages: 'Ngôn ngữ',
  campaign: 'Chiến dịch',
  campaigns: 'Chiến dịch',
  account: 'Tài khoản',
  accounts: 'Tài khoản',
  creative: 'Mẫu quảng cáo',
  creatives: 'Mẫu quảng cáo',
  event: 'Sự kiện',
  events: 'Sự kiện',
  product: 'Sản phẩm',
  products: 'Sản phẩm',
  audience: 'Đối tượng',
  audiences: 'Đối tượng',
  channel: 'Kênh',
  approval: 'Phê duyệt',
  rejection: 'Từ chối',
  optimization: 'Tối ưu hóa',
  structure: 'Cấu trúc',
  service: 'Dịch vụ',
  market: 'Thị trường',
  experience: 'Trải nghiệm',
};

function translateTokenVi(token: string): string {
  if (token.startsWith('~')) return token.slice(1);
  const lower = token.toLowerCase();
  const translated = TOKEN_DICTIONARY_VI[lower];
  if (translated) return translated;
  if (ACRONYM_TOKENS.has(lower)) return lower.toUpperCase();
  return lower;
}

function composeSubPhraseVi(tokens: readonly string[]): string {
  return lowerFirstUnlessAcronym(composeTokensVi(tokens));
}

function composeTokensVi(rawTokens: readonly string[]): string {
  if (rawTokens.length === 0) return '';

  // Check exact match in FIELD_DICTIONARY_VI if no pre-collapsed tokens
  if (rawTokens.every(t => !t.startsWith('~'))) {
    const joinedKey = rawTokens.join('_');
    const directMatch = FIELD_DICTIONARY_VI[joinedKey];
    if (directMatch) return directMatch;
  }

  const tokens = collapseCollocationsVi(rawTokens);

  if (tokens.length === 1) {
    const single = tokens[0];
    if (single.startsWith('~')) return capitalizeFirst(single.slice(1));
    const directSingle = FIELD_DICTIONARY_VI[single];
    if (directSingle) return directSingle;
    const tokenVi = TOKEN_DICTIONARY_VI[single];
    if (tokenVi) return capitalizeFirst(tokenVi);
    if (ACRONYM_TOKENS.has(single)) return single.toUpperCase();
    return capitalizeFirst(single);
  }

  // Peel trailing attribution / time-window / unit qualifiers (`pc30d`, `pv24h`, `micros`, etc.)
  const qualifiers: string[] = [];
  let coreEnd = tokens.length;
  while (coreEnd > 1) {
    const candidate = tokens[coreEnd - 1];
    const qual = TRAILING_QUALIFIERS_VI[candidate];
    if (qual) {
      qualifiers.unshift(qual);
      coreEnd -= 1;
    } else {
      break;
    }
  }
  if (qualifiers.length > 0) {
    const corePhrase = composeTokensVi(tokens.slice(0, coreEnd));
    return `${corePhrase} (${qualifiers.join(', ')})`;
  }

  // Split on relational prepositions (`per`, `by`, `in`, `for`, `vs`)
  const perIdx = tokens.indexOf('per');
  if (perIdx > 0 && perIdx < tokens.length - 1) {
    const left = tokens.slice(0, perIdx);
    const right = tokens.slice(perIdx + 1);
    if (left.length === 1 && left[0] === 'cost') {
      return `Chi phí mỗi ${composeSubPhraseVi(right)}`;
    }
    const leftPhrase = composeTokensVi(left);
    const rightPhrase = composeSubPhraseVi(right);
    return left[left.length - 1] === 'cost'
      ? `${leftPhrase} mỗi ${rightPhrase}`
      : `${leftPhrase} trên mỗi ${rightPhrase}`;
  }

  const byIdx = tokens.indexOf('by');
  if (byIdx > 0 && byIdx < tokens.length - 1) {
    const left = tokens.slice(0, byIdx);
    const right = tokens.slice(byIdx + 1);
    return `${composeTokensVi(left)} theo ${composeSubPhraseVi(right)}`;
  }

  const inIdx = tokens.indexOf('in');
  if (inIdx > 0 && inIdx < tokens.length - 1) {
    const left = tokens.slice(0, inIdx);
    const right = tokens.slice(inIdx + 1);
    return `${composeTokensVi(left)} theo ${composeSubPhraseVi(right)}`;
  }

  const first = tokens[0];
  const last = tokens[tokens.length - 1];
  const withoutFirst = tokens.slice(1);
  const withoutLast = tokens.slice(0, -1);

  // Leading prefix modifiers
  if (first === 'is' && withoutFirst.length > 0) {
    return capitalizeFirst(composeTokensVi(withoutFirst));
  }
  if (first === 'has' && withoutFirst.length > 0) {
    return `Có ${composeSubPhraseVi(withoutFirst)}`;
  }
  if (first === 'can' && withoutFirst.length > 0) {
    return `Cho phép ${composeSubPhraseVi(withoutFirst)}`;
  }
  if (first === 'notified' && withoutFirst[0] === 'on' && withoutFirst.length > 1) {
    return `Thông báo khi ${composeSubPhraseVi(withoutFirst.slice(1))}`;
  }
  if ((first === 'total' || first === 'all') && withoutFirst.length > 0) {
    return `Tổng ${composeSubPhraseVi(withoutFirst)}`;
  }
  if ((first === 'avg' || first === 'average') && withoutFirst.length > 0) {
    return `${capitalizeFirst(composeTokensVi(withoutFirst))} trung bình`;
  }
  if ((first === 'min' || first === 'minimum') && withoutFirst.length > 0) {
    return `${capitalizeFirst(composeTokensVi(withoutFirst))} tối thiểu`;
  }
  if ((first === 'max' || first === 'maximum') && withoutFirst.length > 0) {
    return `${capitalizeFirst(composeTokensVi(withoutFirst))} tối đa`;
  }
  if (first === 'num' && withoutFirst.length > 0) {
    return `Số lượng ${composeSubPhraseVi(withoutFirst)}`;
  }
  if (first === 'viral' && withoutFirst.length > 0) {
    return `${capitalizeFirst(composeTokensVi(withoutFirst))} lan truyền`;
  }
  if (first === 'organic' && withoutFirst.length > 0) {
    return `${capitalizeFirst(composeTokensVi(withoutFirst))} tự nhiên`;
  }
  if (first === 'paid' && withoutFirst.length > 0) {
    return `${capitalizeFirst(composeTokensVi(withoutFirst))} trả phí`;
  }
  if ((first === 'omnichannel' || first === 'omni') && withoutFirst.length > 0) {
    return `${capitalizeFirst(composeTokensVi(withoutFirst))} đa kênh`;
  }
  if ((first === 'estimated' || first === 'approximate') && withoutFirst.length > 0) {
    return `${capitalizeFirst(composeTokensVi(withoutFirst))} ước tính`;
  }
  if (first === 'gmv' && withoutFirst.length > 0) {
    return `${capitalizeFirst(composeTokensVi(withoutFirst))} (GMV)`;
  }

  // Trailing temporal adjectives (`daily`, `monthly`, `weekly`, `hourly`, `lifetime`, `unique`, `all`)
  if (
    (last === 'daily' ||
      last === 'monthly' ||
      last === 'weekly' ||
      last === 'hourly' ||
      last === 'lifetime' ||
      last === 'unique') &&
    withoutLast.length > 0
  ) {
    return `${composeTokensVi(withoutLast)} ${translateTokenVi(last)}`;
  }
  if (last === 'all' && withoutLast.length > 0) {
    return `Tổng ${composeSubPhraseVi(withoutLast)}`;
  }
  if (last === 'str' && withoutLast.length > 0) {
    return `${composeTokensVi(withoutLast)} (chuỗi)`;
  }
  if (last === 'enabled' && withoutLast.length > 0) {
    return `Bật ${composeSubPhraseVi(withoutLast)}`;
  }
  if (last === 'required' && withoutLast.length > 0) {
    return `Yêu cầu ${composeSubPhraseVi(withoutLast)}`;
  }

  // Trailing head-noun reordering (`[modifier] + [head_noun]` -> `[head_noun] + [modifier]`)
  const headNounVi = HEAD_NOUN_SUFFIX_VI[last];
  if (headNounVi && withoutLast.length > 0) {
    return `${headNounVi} ${composeSubPhraseVi(withoutLast)}`;
  }

  if (first === 'date' && withoutFirst.length > 0) {
    return `Ngày ${composeSubPhraseVi(withoutFirst)}`;
  }

  // Fallback: translate tokens if any are known in Vietnamese dictionary or pre-collapsed
  const hasAnyVietnameseToken = tokens.some(
    t => t.startsWith('~') || t in TOKEN_DICTIONARY_VI
  );
  if (hasAnyVietnameseToken) {
    return capitalizeFirst(tokens.map(translateTokenVi).join(' '));
  }

  return humanizeTokensEn(rawTokens);
}

function humanizeSegmentVi(rawSegment: string): string {
  const trimmed = rawSegment.trim();
  if (!trimmed) return rawSegment;

  const lowerRaw = trimmed.toLowerCase();
  const directRaw = FIELD_DICTIONARY_VI[lowerRaw];
  if (directRaw) return directRaw;

  const strippedUnderscore = lowerRaw.replace(/^_+/, '');
  const directStripped = FIELD_DICTIONARY_VI[strippedUnderscore];
  if (directStripped) return directStripped;

  const tokens = tokenizeFieldName(trimmed);
  if (tokens.length === 0) return trimmed;

  const normalizedSnake = tokens.join('_');
  const directNormalized = FIELD_DICTIONARY_VI[normalizedSnake];
  if (directNormalized) return directNormalized;

  // Handle `_owox_*` or `owox_*` prefix
  if (tokens[0] === 'owox' && tokens.length > 1) {
    const inner = humanizeSegmentVi(tokens.slice(1).join('_'));
    return `${inner} (OWOX)`;
  }

  return composeTokensVi(tokens);
}

function humanizeSegmentEn(rawSegment: string): string {
  const trimmed = rawSegment.trim();
  if (!trimmed) return rawSegment;

  // If already a human phrase with spaces and no underscores, preserve it
  if (trimmed.includes(' ') && !trimmed.includes('_')) {
    return trimmed;
  }

  const tokens = tokenizeFieldName(trimmed);
  if (tokens.length === 0) return trimmed;
  return humanizeTokensEn(tokens);
}

/**
 * Converts a technical field name (`snake_case`, `camelCase`, `PascalCase`, or dotted path)
 * into a user-friendly display label without altering the underlying identifier.
 */
export function humanizeFieldName(
  technicalName: string,
  options: HumanizeFieldOptions = {}
): string {
  const trimmed = technicalName.trim();
  if (!trimmed) return technicalName;

  const locale = resolveHumanizeLocale(options.locale);

  // Check whole-string match in VI dictionary first (e.g. `ad-account/insights`)
  if (locale === 'vi') {
    const directWhole = FIELD_DICTIONARY_VI[trimmed.toLowerCase()];
    if (directWhole) {
      return options.includeTechnicalName && directWhole !== trimmed
        ? `${directWhole} (${trimmed})`
        : directWhole;
    }
  }

  const segments = trimmed.split('.');
  const targetSegments =
    options.leafOnly && segments.length > 1 ? [segments[segments.length - 1]] : segments;

  const humanizedSegments = targetSegments.map(segment =>
    locale === 'vi' ? humanizeSegmentVi(segment) : humanizeSegmentEn(segment)
  );

  const label = humanizedSegments.join(' · ');

  if (options.includeTechnicalName && label !== trimmed) {
    return `${label} (${trimmed})`;
  }

  return label;
}

/**
 * Generates unique, user-friendly aliases for a list of schema fields.
 * Preserves existing non-empty aliases and disambiguates any collisions by appending ` (field.name)`.
 */
export function generateUniqueFieldAliases(
  fields: readonly { name: string; alias?: string }[],
  locale?: HumanizeLocale
): Map<string, string> {
  const resolvedLocale = resolveHumanizeLocale(locale);
  const usedAliasesLower = new Set<string>();

  // Reserve existing user-defined aliases first (ignoring raw default aliases where alias === name)
  for (const field of fields) {
    const name = field.name.trim();
    const existing = field.alias?.trim();
    if (existing && existing.toLowerCase() !== name.toLowerCase()) {
      usedAliasesLower.add(existing.toLowerCase());
    }
  }

  // First pass: compute candidate aliases for fields missing a custom alias
  const candidates = new Map<string, string>();
  const candidateCounts = new Map<string, number>();

  for (const field of fields) {
    const name = field.name.trim();
    const existing = field.alias?.trim();
    if (!name || (existing && existing.toLowerCase() !== name.toLowerCase())) continue;
    const candidate = humanizeFieldName(name, { locale: resolvedLocale });
    candidates.set(field.name, candidate);
    const key = candidate.toLowerCase();
    candidateCounts.set(key, (candidateCounts.get(key) ?? 0) + 1);
  }

  // Second pass: assign unique aliases, disambiguating collisions
  const result = new Map<string, string>();
  for (const field of fields) {
    const name = field.name.trim();
    const existing = field.alias?.trim();
    if (!name || (existing && existing.toLowerCase() !== name.toLowerCase())) continue;
    const candidate = candidates.get(field.name) ?? name;
    const candidateKey = candidate.toLowerCase();

    const collidesWithExisting = usedAliasesLower.has(candidateKey);
    const collidesWithSibling = (candidateCounts.get(candidateKey) ?? 0) > 1;

    let finalAlias = candidate;
    if (collidesWithExisting || collidesWithSibling) {
      finalAlias = `${candidate} (${name})`;
    }

    usedAliasesLower.add(finalAlias.toLowerCase());
    if (finalAlias !== existing) {
      result.set(field.name, finalAlias);
    }
  }

  return result;
}
