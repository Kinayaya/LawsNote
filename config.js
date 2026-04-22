// KLaws script.js — 完整版（精簡行數）
// ==================== 資料定義 ====================
const DEFAULTS = {
  notes: [
    {id:1,type:'article',subject:'民法',title:'民法第 184 條 — 侵權行為',body:'因故意或過失，不法侵害他人之權利者，負損害賠償責任。',tags:['侵權行為','損害賠償'],date:'2025-03-10',detail:'構成要件：\n1. 須有加害行為\n2. 行為須不法\n3. 須有故意或過失\n4. 須有損害\n5. 加害行為與損害間有因果關係'},
    {id:2,type:'case',subject:'刑法',title:'釋字第 775 號 — 累犯加重規定',body:'累犯一律加重最低本刑，違反憲法比例原則，應依個案審查。',tags:['累犯','比例原則'],date:'2025-02-28',detail:'大法官認定相關規定違憲，法院應依個案情形審查，不得機械式適用加重。'},
  ],
  links: [{id:1,from:3,to:4,rel:'關聯',color:'#378ADD'},{id:2,from:3,to:2,rel:'關聯',color:'#378ADD'},{id:3,from:1,to:5,rel:'關聯',color:'#378ADD'}],
  types: [{key:'article',label:'條文',color:'#007AFF'},{key:'case',label:'案例',color:'#1D9E75'},{key:'concept',label:'概念',color:'#7F77DD'},{key:'diary',label:'日記',color:'#D85A30'}],
  subjects: [{key:'民法',label:'民法',color:'#D85A30'},{key:'刑法',label:'刑法',color:'#1D9E75'},{key:'憲法',label:'憲法',color:'#7F77DD'},{key:'行政法',label:'行政法',color:'#378ADD'}],
  chapters: [
    {key:'總則',label:'總則',subject:'民法'},{key:'法律行為',label:'法律行為',subject:'民法'},
  ],
  sections: []
};
const LINK_COLOR = '#378ADD', SKEY = 'legal_notes_v4', PAGE_SIZE = 30;
const ARCHIVES_KEY = 'klaws_archives_v1';
const ARCHIVE_SNAPSHOT_LIMIT = 30;
const RECYCLE_BIN_KEY = 'klaws_recycle_bin_v1';
const UNUSED_TAG_TRACK_KEY = 'klaws_unused_tag_tracker_v1';
const RECYCLE_RETENTION_MS = 7*24*60*60*1000;
const UNUSED_TAG_PURGE_MS = 10*60*1000;
const SCOPE_LINKED_TOGGLE_KEY = 'klaws_scope_linked_toggle_v1';
const COMPACT_FILTER_KEY = 'klaws_compact_filters_v1';
const USAGE_START_KEY = 'klaws_usage_start_v1';
const FORM_TAXONOMY_PREF_KEY = 'klaws_form_taxonomy_pref_v1';
const LAST_VIEW_STATE_KEY = 'klaws_last_view_state_v1';
const THEME_MODE_KEY = 'klaws_theme_mode_v1';
const SYNC_KEY = 'klaws_sync_v1', SYNC_FILE = 'klaws_data.json';
const AI_MODELS = [
  {id:'openrouter/free', label:'🔀 自動選最佳免費模型（推薦）'},
  {id:'meta-llama/llama-3.3-70b-instruct:free', label:'Llama 3.3 70B（Meta）'},
  {id:'google/gemini-2.0-flash-exp:free', label:'Gemini 2.0 Flash（Google）'},
  {id:'deepseek/deepseek-r1:free', label:'DeepSeek R1（推理強）'},
  {id:'mistralai/mistral-small-3.1-24b-instruct:free', label:'Mistral Small 3.1'}
];
const DEFAULT_SHORTCUTS = [
  {id:'new',label:'新增筆記',code:'KeyN',alt:true},{id:'search',label:'搜尋',code:'KeyF',alt:true},
  {id:'map',label:'開啟體系圖',code:'KeyM',alt:true},{id:'back',label:'返回筆記列表',code:'Escape'},
  {id:'close',label:'關閉面板',code:'KeyW',alt:true},{id:'edit',label:'編輯當前筆記',code:'KeyE',alt:true},
  {id:'link',label:'新增關聯',code:'KeyL',alt:true},{id:'export',label:'存檔管理',code:'KeyS',alt:true},
  {id:'shortcuts',label:'快捷鍵設定',code:'KeyK',alt:true},
  {id:'stats',label:'統計',code:'KeyI',alt:true}
];
const BUILTIN_FIELD_DEFS = {
  body:{key:'body',label:'摘要',kind:'textarea',placeholder:'條文或重點摘要...'},
  detail:{key:'detail',label:'詳細筆記',kind:'textarea',placeholder:'構成要件、學說、實務見解...'},
  todos:{key:'todos',label:'📝 待辦清單（每行一項，開頭 [x] 代表已完成）',kind:'textarea',placeholder:'[ ] 完成筆記整理\n[x] 複習例題第 3 題'}
};
const DEFAULT_TYPE_FIELD_KEYS = {diary:['body','todos']};
const DEFAULT_NORMAL_FIELD_KEYS = ['body','detail'];


const { safeStr, uniq, pad2, escapeHtml, hl, parseTodos, formatTodosForEdit, parseSearchDateVariants, formatDate, normalizeNoteSchema } = window.KLawsUtils;
const { readJSON, writeJSON } = window.KLawsStorage;
const { renderTodoHtml, sortedNotes } = window.KLawsRender;
const { MAP_NODE_RADIUS_MIN, MAP_NODE_RADIUS_MAX, MAP_NODE_RADIUS_DEFAULT, MAP_LIGHT_BUNDLING_STRENGTH, DEFAULT_LANE_NAMES, MIN_LANE_COUNT, MAX_LANE_COUNT, clampMapRadius, defaultLaneNameAt, normalizeLaneCount, splitMapTitleLines } = window.KLawsMap;
const { fmtDateKey, dueTimeText, relativeDateLabel } = window.KLawsCalendar;

