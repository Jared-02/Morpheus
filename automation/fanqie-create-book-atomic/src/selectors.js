const defaultSelectors = {
  bookTitle: [
    "input[placeholder='请输入作品名称']",
    "input[placeholder*='书名']",
    "input[placeholder*='作品名']",
  ],
  bookIntro: [
    "textarea[placeholder*='50-500字以内的作品简介']",
    "textarea[placeholder*='简介']",
    "textarea[placeholder*='作品简介']",
  ],
  protagonist1: ["input[placeholder='请输入主角名1']"],
  protagonist2: ["input[placeholder='请输入主角名2']"],
  targetReaderMale: [
    "label:has-text('男频')",
    "input[name='pindao'][value='1']",
    ".arco-radio:has-text('男频')",
  ],
  targetReaderFemale: [
    "label:has-text('女频')",
    "input[name='pindao'][value='0']",
    ".arco-radio:has-text('女频')",
  ],
  tagTrigger: [
    "#selectRow .select-view",
    "#selectRow .view-inner-wrap",
    "#selectRow .select-row",
    "div[id='selectRow'] .select-view",
    "div[id='selectRow'] .view-inner-wrap",
    "div[id='selectRow'] .select-row",
    '#selectRow_input .select-view',
    '.serial-form-item.cate-wrap .select-view',
    '.serial-form-item.cate-wrap .view-inner-wrap',
    '.select-row .select-view',
    '.tomato-down-arrow',
  ],
  tagOptions: [
    '.arco-select-option',
    "li[role='option']",
    '.arco-select-option-content',
    '.byte-select-option',
    'span.item-title',
  ],
  tagModal: [
    "div[role='dialog'].category-modal",
    "div[role='dialog']:has-text('作品标签')",
  ],
  tagModalConfirmButton: [
    "button.arco-btn-primary:has-text('确认')",
    "button:has-text('确认')",
  ],
  selectedTagRemove: ['.create-category-item .item-del', '.create-category-item .tomato-close'],
  coverFileInput: ["input[type='file']"],
  submitButton: [
    "button.serial-arco-btn:has-text('立即创建')",
    "button:has-text('立即创建')",
    "button:has-text('创建作品')",
    "button:has-text('创建书本')",
    "button:has-text('下一步')",
    "button:has-text('提交')",
  ],
};

function getSelectors(config) {
  return { ...defaultSelectors, ...(config?.selectors || {}) };
}

module.exports = {
  defaultSelectors,
  getSelectors,
};
