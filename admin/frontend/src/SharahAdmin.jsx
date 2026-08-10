import React, { useEffect, useMemo, useState } from 'react';
import { hasPermission } from './permissions.js';
import { addSharahReelUrl, getSharedSharahAdminTokenStatus, getSharahAdminTags, getSharahAssetUrl, getSharahFacebookReels, getSharahPlatformSettings, getSharahPopularTags, getSharahTiktokReels, saveSharedSharahAdminToken, updateSharahAdminTags, updateSharahPlatformSettings, updateSharahPopularTags, updateSharahReelTags, updateSharahReelVisibility } from './sharahApi.js';

const TAGS_STORAGE_KEY = 'shara_admin_tags';

function normalizeTags(value) {
  const source = Array.isArray(value) ? value : String(value || '').split(/[،,\n]/);
  const seen = new Set();
  const tags = [];
  for (const item of source) {
    const tag = String(item || '').trim();
    if (!tag || seen.has(tag)) continue;
    seen.add(tag);
    tags.push(tag);
  }
  return tags;
}

function normalizeSearchText(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[\u0610-\u061a\u064b-\u065f\u0670\u06d6-\u06ed]/g, '')
    .replace(/ـ/g, '')
    .replace(/[إأآٱا]/g, 'ا')
    .replace(/ى/g, 'ي')
    .replace(/ؤ/g, 'و')
    .replace(/ئ/g, 'ي')
    .replace(/[^\w\u0621-\u064a\u0660-\u0669\u06f0-\u06f9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function canonicalTag(value) {
  return normalizeSearchText(value)
    .split(' ')
    .filter(Boolean)
    .map((token) => (token.startsWith('ال') && token.length > 4 ? token.slice(2) : token))
    .join(' ')
    .trim();
}

function tagMatchesQuery(tag, query) {
  const tagText = normalizeSearchText(tag);
  const queryText = normalizeSearchText(query);
  if (!queryText) return true;
  if (!tagText) return false;
  return tagText === queryText || canonicalTag(tagText) === canonicalTag(queryText);
}

function normalizePopularTags(value) {
  const source = Array.isArray(value) ? value : [];
  const seen = new Set();
  const tags = [];
  for (const item of source) {
    const tag = String(typeof item === 'string' ? item : item?.tag || '').trim();
    if (!tag || seen.has(tag)) continue;
    seen.add(tag);
    tags.push({ tag, hidden: !!(typeof item === 'object' && item?.hidden) });
  }
  return tags;
}

function normalizePopularSettings(value) {
  if (Array.isArray(value)) return { enabled: true, tags: normalizePopularTags(value) };
  return { enabled: !!(value?.enabled ?? true), tags: normalizePopularTags(value?.tags) };
}

function normalizePlatformSettings(value) {
  const settings = {
    facebook: !!(value?.facebook ?? true),
    tiktok: !!(value?.tiktok ?? false)
  };
  if (!settings.facebook && !settings.tiktok) settings.facebook = true;
  return settings;
}

function readStoredTags() {
  try {
    return normalizeTags(JSON.parse(localStorage.getItem(TAGS_STORAGE_KEY) || '[]'));
  } catch {
    return [];
  }
}

function writeStoredTags(tags) {
  localStorage.setItem(TAGS_STORAGE_KEY, JSON.stringify(normalizeTags(tags)));
}

function normalizeReel(reel, platform) {
  const normalizedPlatform = String(reel?.platform || platform || 'facebook').toLowerCase();
  const id = String(reel?.id || '');
  return {
    ...reel,
    id,
    platform: normalizedPlatform,
    title: String(reel?.title || 'بدون عنوان').trim() || 'بدون عنوان',
    tags: normalizeTags(reel?.tags || reel?.admin_tags),
    url: String(reel?.facebookReelUrl || reel?.videoUrl || reel?.url || '').trim(),
    thumbnail: getSharahAssetUrl(reel?.thumbnail),
    hidden: !!(reel?.hidden || reel?.is_hidden)
  };
}

function tagStatsFromReels(tags, reels) {
  const counts = new Map(tags.map((tag) => [tag, 0]));
  for (const reel of reels) {
    for (const tag of normalizeTags(reel.tags)) {
      counts.set(tag, (counts.get(tag) || 0) + 1);
    }
  }
  return Array.from(counts.entries())
    .map(([tag, count]) => ({ tag, count }))
    .sort((a, b) => a.tag.localeCompare(b.tag, 'ar'));
}

function assignedTagCounts(reels) {
  const counts = new Map();
  for (const reel of reels) {
    for (const tag of normalizeTags(reel.tags)) {
      counts.set(tag, (counts.get(tag) || 0) + 1);
    }
  }
  return counts;
}

function normalizeReelResponse(value) {
  if (Array.isArray(value)) return value;
  if (Array.isArray(value?.items)) return value.items;
  if (Array.isArray(value?.data)) return value.data;
  if (Array.isArray(value?.reels)) return value.reels;
  throw new Error(value?.error || value?.message || 'Shara API returned an invalid reels response.');
}

function AddTagsDialog({ onClose, onSave }) {
  const [tagsText, setTagsText] = useState('');

  return (
    <div className="modal-backdrop" role="presentation" onClick={onClose}>
      <div className="modal" role="dialog" aria-modal="true" aria-labelledby="shara-add-tags-title" onClick={(event) => event.stopPropagation()}>
        <div className="modal-header">
          <h3 id="shara-add-tags-title">إضافة وسوم</h3>
          <button className="secondary small" onClick={onClose} type="button">إغلاق</button>
        </div>
        <div className="sharah-dialog-body">
          <label>
            الوسوم
            <textarea
              value={tagsText}
              onChange={(event) => setTagsText(event.target.value)}
              placeholder="اكتب كل وسم في سطر أو افصلها بفواصل"
            />
          </label>
          <div className="row">
            <button type="button" onClick={() => onSave(normalizeTags(tagsText))}>Add Tags</button>
            <button className="secondary" type="button" onClick={onClose}>إلغاء</button>
          </div>
        </div>
      </div>
    </div>
  );
}

function AddReelDialog({ saving, onClose, onSave }) {
  const [url, setUrl] = useState('');

  const submit = (event) => {
    event.preventDefault();
    onSave(url);
  };

  return (
    <div className="modal-backdrop" role="presentation" onClick={onClose}>
      <div className="modal" role="dialog" aria-modal="true" aria-labelledby="shara-add-reel-title" onClick={(event) => event.stopPropagation()}>
        <div className="modal-header">
          <h3 id="shara-add-reel-title">إضافة ريل</h3>
          <button className="secondary small" onClick={onClose} type="button" disabled={saving}>إغلاق</button>
        </div>
        <form className="sharah-dialog-body" onSubmit={submit}>
          <label>
            رابط الريل
            <input
              value={url}
              onChange={(event) => setUrl(event.target.value)}
              placeholder="https://www.facebook.com/.../reel/... أو https://www.tiktok.com/@.../video/..."
              dir="ltr"
              autoFocus
            />
          </label>
          <p className="muted">سيتم إضافة الريل إلى موقع Shara، وسيحاول النظام جلب العنوان والصورة تلقائياً من الرابط.</p>
          <div className="row">
            <button type="submit" disabled={saving || !url.trim()}>{saving ? 'جارٍ الإضافة...' : 'Add Reel'}</button>
            <button className="secondary" type="button" onClick={onClose} disabled={saving}>إلغاء</button>
          </div>
        </form>
      </div>
    </div>
  );
}

function SharaTagDialog({ reel, tags, saving, onAddGlobalTags, onClose, onSave }) {
  const [tagQuery, setTagQuery] = useState('');
  const [draftTags, setDraftTags] = useState(() => normalizeTags(reel?.tags));

  useEffect(() => {
    setDraftTags(normalizeTags(reel?.tags));
    setTagQuery('');
  }, [reel]);

  if (!reel) return null;

  const availableTags = tags.filter((tag) => !draftTags.includes(tag));

  const addTagQuery = () => {
    const nextTags = normalizeTags(tagQuery);
    if (nextTags.length === 0) return;
    onAddGlobalTags(nextTags);
    setDraftTags((current) => normalizeTags([...current, ...nextTags]));
    setTagQuery('');
  };

  return (
    <div className="modal-backdrop" role="presentation" onClick={onClose}>
      <div className="modal" role="dialog" aria-modal="true" aria-labelledby="shara-tag-dialog-title" onClick={(event) => event.stopPropagation()}>
        <div className="modal-header">
          <h3 id="shara-tag-dialog-title">تعديل وسوم الريل</h3>
          <button className="secondary small" onClick={onClose} type="button">إغلاق</button>
        </div>
        <div className="sharah-dialog-body">
          <div className="sharah-dialog-reel">
            {reel.thumbnail ? <img src={reel.thumbnail} alt="" /> : <div className="sharah-reel-placeholder">بدون صورة</div>}
            <strong>{reel.title}</strong>
          </div>

          <div>
            <div className="muted">الوسوم المختارة</div>
            <div className="sharah-tag-list">
              {draftTags.length > 0 ? draftTags.map((tag) => (
                <button key={tag} className="sharah-tag-chip removable" type="button" onClick={() => setDraftTags((current) => current.filter((item) => item !== tag))}>
                  {tag} ×
                </button>
              )) : <span className="muted">لا توجد وسوم بعد</span>}
            </div>
          </div>

          <div className="sharah-tag-add-row">
            <input
              value={tagQuery}
              onChange={(event) => setTagQuery(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter') {
                  event.preventDefault();
                  addTagQuery();
                }
              }}
              list="shara-tag-options"
              placeholder="ابحث عن وسم أو اكتب وسم جديد"
            />
            <datalist id="shara-tag-options">
              {availableTags.map((tag) => <option key={tag} value={tag} />)}
            </datalist>
            <button type="button" onClick={addTagQuery} disabled={!tagQuery.trim()}>+</button>
          </div>

          <div className="row">
            <button type="button" onClick={() => onSave(normalizeTags([...draftTags, ...normalizeTags(tagQuery)]))} disabled={saving}>{saving ? 'جارٍ الحفظ...' : 'حفظ الوسوم'}</button>
            <button className="secondary" type="button" onClick={onClose} disabled={saving}>إلغاء</button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function SharahAdmin({ currentAdmin, showToast, setError }) {
  const [activeSection, setActiveSection] = useState('tags');
  const [tags, setTags] = useState(() => readStoredTags());
  const [reels, setReels] = useState([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState('');
  const [editingReel, setEditingReel] = useState(null);
  const [showAddTags, setShowAddTags] = useState(false);
  const [showAddReel, setShowAddReel] = useState(false);
  const [saving, setSaving] = useState(false);
  const [savingVisibilityKey, setSavingVisibilityKey] = useState('');
  const [popularSettings, setPopularSettings] = useState({ enabled: true, tags: [] });
  const [popularTagInput, setPopularTagInput] = useState('');
  const [showPopularTagOptions, setShowPopularTagOptions] = useState(false);
  const [savingPopularTags, setSavingPopularTags] = useState(false);
  const [savingAdminTags, setSavingAdminTags] = useState(false);
  const [platformSettings, setPlatformSettings] = useState({ facebook: true, tiktok: false });
  const [savingPlatformSettings, setSavingPlatformSettings] = useState(false);
  const [platformFilter, setPlatformFilter] = useState('all');
  const [tagFilter, setTagFilter] = useState('all');
  const [visibilityFilter, setVisibilityFilter] = useState('all');
  const [showPlatformMenu, setShowPlatformMenu] = useState(false);
  const [sharahTokenDraft, setSharahTokenDraft] = useState('');
  const [sharahTokenConfigured, setSharahTokenConfigured] = useState(false);
  const [savingSharahToken, setSavingSharahToken] = useState(false);

  const canManage = hasPermission(currentAdmin, 'sharah', 'manage');

  const saveAdminTags = async (nextTags, successMessage = 'تم حفظ الوسوم') => {
    const normalized = normalizeTags(nextTags);
    setSavingAdminTags(true);
    setError?.('');
    try {
      const saved = normalizeTags(await updateSharahAdminTags(normalized));
      setTags(saved);
      writeStoredTags(saved);
      showToast?.('success', successMessage);
    } catch (err) {
      setError?.(err.message || 'فشل حفظ الوسوم العامة.');
    } finally {
      setSavingAdminTags(false);
    }
  };

  const addGlobalTags = (nextTags) => {
    saveAdminTags([...tags, ...nextTags], 'تمت إضافة الوسوم');
  };

  const loadSharahTokenStatus = async () => {
    if (!canManage) return;
    try {
      const status = await getSharedSharahAdminTokenStatus();
      setSharahTokenConfigured(!!status?.configured);
    } catch (err) {
      setError?.(err.message || 'فشل تحميل حالة Shara admin token');
    }
  };

  const saveSharahToken = async () => {
    setSavingSharahToken(true);
    setError?.('');
    try {
      const status = await saveSharedSharahAdminToken(sharahTokenDraft);
      const configured = !!status?.configured;
      setSharahTokenConfigured(configured);
      setSharahTokenDraft('');
      showToast?.('success', configured ? 'تم حفظ Shara admin token للجميع' : 'تم حذف Shara admin token للجميع');
      loadReels();
      loadPopularTags();
      loadAdminTags();
    } catch (err) {
      setError?.(err.message || 'فشل حفظ Shara admin token');
    } finally {
      setSavingSharahToken(false);
    }
  };

  const loadReels = async () => {
    setLoading(true);
    setError?.('');
    try {
      const [facebook, tiktok] = await Promise.allSettled([
        getSharahFacebookReels(),
        getSharahTiktokReels()
      ]);
      const nextReels = [
        ...(facebook.status === 'fulfilled' ? normalizeReelResponse(facebook.value).map((item) => normalizeReel(item, 'facebook')) : []),
        ...(tiktok.status === 'fulfilled' ? normalizeReelResponse(tiktok.value).map((item) => normalizeReel(item, 'tiktok')) : [])
      ].filter((reel) => reel.id);

      setReels(nextReels);
      if (facebook.status === 'rejected' || tiktok.status === 'rejected') {
        setError?.('تم تحميل بعض بيانات Shara فقط. تحقق من اتصال API إذا كانت القائمة ناقصة.');
      }
    } catch (err) {
      setError?.(err.message || 'فشل تحميل بيانات Shara');
    } finally {
      setLoading(false);
    }
  };

  const loadPopularTags = async () => {
    try {
      setPopularSettings(normalizePopularSettings(await getSharahPopularTags()));
    } catch (err) {
      setError?.(err.message || 'فشل تحميل وسوم شائع');
    }
  };

  const loadAdminTags = async () => {
    try {
      const saved = normalizeTags(await getSharahAdminTags());
      setTags(saved);
      writeStoredTags(saved);
    } catch (err) {
      if (sharahTokenConfigured) setError?.(err.message || 'فشل تحميل الوسوم العامة');
    }
  };

  const loadPlatformSettings = async () => {
    try {
      setPlatformSettings(normalizePlatformSettings(await getSharahPlatformSettings()));
    } catch (err) {
      setError?.(err.message || 'فشل تحميل إعدادات المنصات');
    }
  };

  useEffect(() => {
    loadSharahTokenStatus();
    loadReels();
    loadPopularTags();
    loadAdminTags();
    loadPlatformSettings();
  }, []);

  const reelTagCounts = useMemo(() => assignedTagCounts(reels), [reels]);
  const allTags = useMemo(() => normalizeTags([
    ...tags,
    ...reels.flatMap((reel) => reel.tags),
    ...popularSettings.tags.map((item) => item.tag)
  ]), [tags, reels, popularSettings]);
  const availablePopularTags = useMemo(() => {
    const popularTagSet = new Set(popularSettings.tags.map((item) => item.tag));
    return allTags.filter((tag) => !popularTagSet.has(tag));
  }, [allTags, popularSettings]);
  const filteredPopularTagOptions = useMemo(() => {
    const text = popularTagInput.trim().toLowerCase();
    if (!text) return availablePopularTags;
    return availablePopularTags.filter((tag) => tag.toLowerCase().includes(text));
  }, [availablePopularTags, popularTagInput]);
  const tagStats = useMemo(() => tagStatsFromReels(allTags, reels), [allTags, reels]);
  const filteredReels = useMemo(() => {
    const text = query.trim();
    return reels.filter((reel) => {
      if (platformFilter !== 'all' && reel.platform !== platformFilter) return false;
      if (visibilityFilter === 'visible' && reel.hidden) return false;
      if (visibilityFilter === 'hidden' && !reel.hidden) return false;
      const hasTags = normalizeTags(reel.tags).length > 0;
      if (tagFilter === 'tagged' && !hasTags) return false;
      if (tagFilter === 'untagged' && hasTags) return false;
      if (!text) return true;
      return normalizeTags(reel.tags).some((tag) => tagMatchesQuery(tag, text));
    });
  }, [query, platformFilter, visibilityFilter, tagFilter, reels]);

  const saveTags = async (nextTags) => {
    if (!editingReel) return;
    setSaving(true);
    setError?.('');
    try {
      const updated = await updateSharahReelTags(editingReel.platform, editingReel.id, nextTags);
      const savedTags = normalizeTags(updated?.tags || nextTags);
      setReels((current) => current.map((reel) => (
        reel.platform === editingReel.platform && reel.id === editingReel.id
          ? { ...reel, tags: savedTags }
          : reel
      )));
      setEditingReel(null);
      showToast?.('success', 'تم حفظ وسوم الريل');
    } catch (err) {
      setError?.(err.message || 'فشل حفظ الوسوم. تأكد من إعداد VITE_SHARAH_ADMIN_TOKEN.');
    } finally {
      setSaving(false);
    }
  };

  const addReel = async (url) => {
    const reelUrl = String(url || '').trim();
    if (!reelUrl) return;
    setSaving(true);
    setError?.('');
    try {
      const created = normalizeReel(await addSharahReelUrl(reelUrl));
      setReels((current) => {
        const next = current.filter((reel) => !(reel.platform === created.platform && reel.id === created.id));
        return [created, ...next];
      });
      setShowAddReel(false);
      setActiveSection('reels');
      setQuery('');
      showToast?.('success', 'تمت إضافة الريل إلى Shara');
    } catch (err) {
      setError?.(err.message || 'فشل إضافة الريل. تأكد من الرابط وإعداد VITE_SHARAH_ADMIN_TOKEN.');
    } finally {
      setSaving(false);
    }
  };

  const toggleVisibility = async (reel) => {
    if (!reel || !canManage) return;
    const key = `${reel.platform}-${reel.id}`;
    setSavingVisibilityKey(key);
    setError?.('');
    try {
      const updated = normalizeReel(await updateSharahReelVisibility(reel.platform, reel.id, !reel.hidden), reel.platform);
      setReels((current) => current.map((item) => (
        item.platform === reel.platform && item.id === reel.id
          ? { ...item, hidden: updated.hidden }
          : item
      )));
      showToast?.('success', updated.hidden ? 'تم إخفاء الريل من Shara' : 'تم إظهار الريل على Shara');
    } catch (err) {
      setError?.(err.message || 'فشل تحديث ظهور الريل. تأكد من إعداد VITE_SHARAH_ADMIN_TOKEN.');
    } finally {
      setSavingVisibilityKey('');
    }
  };

  const savePopularTags = async (nextTags, successMessage = 'تم حفظ وسوم شائع') => {
    setSavingPopularTags(true);
    setError?.('');
    try {
      const saved = normalizePopularSettings(await updateSharahPopularTags(nextTags));
      setPopularSettings(saved);
      showToast?.('success', successMessage);
    } catch (err) {
      setError?.(err.message || 'فشل حفظ وسوم شائع. تأكد من إعداد VITE_SHARAH_ADMIN_TOKEN.');
    } finally {
      setSavingPopularTags(false);
    }
  };

  const addPopularTag = () => {
    const requestedTag = String(popularTagInput || '').trim();
    if (!requestedTag) return;
    const selectedTag = availablePopularTags.find((tag) => tag === requestedTag);
    if (!selectedTag) {
      setError?.('اختر وسم موجود من القائمة فقط. لإضافة وسم جديد استخدم Add Tags أولاً.');
      return;
    }
    const merged = [...popularSettings.tags, { tag: selectedTag, hidden: false }];
    setPopularTagInput('');
    setShowPopularTagOptions(false);
    savePopularTags({ ...popularSettings, tags: merged }, 'تمت إضافة الوسم إلى شائع');
  };

  const togglePopularTag = (tag) => {
    savePopularTags({ ...popularSettings, tags: popularSettings.tags.map((item) => item.tag === tag ? { ...item, hidden: !item.hidden } : item) }, 'تم تحديث ظهور الوسم');
  };

  const deletePopularTag = (tag) => {
    savePopularTags({ ...popularSettings, tags: popularSettings.tags.filter((item) => item.tag !== tag) }, 'تم حذف الوسم من شائع');
  };

  const togglePopularSection = () => {
    savePopularTags({ ...popularSettings, enabled: !popularSettings.enabled }, popularSettings.enabled ? 'تم إخفاء قسم شائع' : 'تم إظهار قسم شائع');
  };

  const togglePlatform = async (platform) => {
    if (!canManage || savingPlatformSettings) return;
    const nextSettings = normalizePlatformSettings({ ...platformSettings, [platform]: !platformSettings[platform] });
    setSavingPlatformSettings(true);
    setError?.('');
    try {
      const saved = normalizePlatformSettings(await updateSharahPlatformSettings(nextSettings));
      setPlatformSettings(saved);
      showToast?.('success', saved[platform] ? 'تم إظهار المنصة في Shara' : 'تم إخفاء المنصة من Shara');
    } catch (err) {
      setError?.(err.message || 'فشل حفظ إعدادات المنصات. تأكد من إعداد VITE_SHARAH_ADMIN_TOKEN.');
    } finally {
      setSavingPlatformSettings(false);
    }
  };

  return (
    <section className="card sharah-admin">
      <div className="card-header">
        <div>
          <h2>Shara</h2>
          <p className="muted">إدارة ظهور الريلز والوسوم المرتبطة بها.</p>
        </div>
        <div className="row">
          <button type="button" onClick={() => setShowAddReel(true)} disabled={!canManage || saving}>Add Reel</button>
          <button className="secondary" type="button" onClick={loadReels} disabled={loading}>{loading ? 'جارٍ التحميل...' : 'تحديث'}</button>
        </div>
      </div>

      {canManage && (
        <div className="row" style={{ justifyContent: 'flex-end', marginBottom: 16 }}>
          <span className="muted">{sharahTokenConfigured ? 'Shara admin token محفوظ' : 'أدخل Shara admin token لعرض المخفي وتعديل الوسوم'}</span>
          <input
            type="password"
            value={sharahTokenDraft}
            onChange={(event) => setSharahTokenDraft(event.target.value)}
            placeholder={sharahTokenConfigured ? 'اتركه فارغاً لحذف التوكن أو أدخل توكن جديد' : 'Shara admin token'}
            dir="ltr"
            style={{ maxWidth: 320 }}
            disabled={savingSharahToken}
          />
          <button className="secondary" type="button" onClick={saveSharahToken} disabled={savingSharahToken}>{savingSharahToken ? 'جارٍ الحفظ...' : 'حفظ التوكن'}</button>
        </div>
      )}

      <div className="sharah-tabs">
        <button type="button" className={activeSection === 'tags' ? 'active' : ''} onClick={() => setActiveSection('tags')}>الوسوم</button>
        <button type="button" className={activeSection === 'reels' ? 'active' : ''} onClick={() => { setQuery(''); setActiveSection('reels'); }}>وسوم الريلز</button>
        <div className="sharah-platform-menu-wrap">
          <button type="button" className="secondary" onClick={() => setShowPlatformMenu((current) => !current)}>منصات Shara الظاهرة</button>
          {showPlatformMenu ? (
            <div className="sharah-platform-menu">
              <div className="sharah-platform-menu-row">
                <span>فيسبوك</span>
                <button
                  type="button"
                  className={`switch-toggle${platformSettings.facebook ? ' on' : ''}`}
                  aria-pressed={platformSettings.facebook}
                  onClick={() => togglePlatform('facebook')}
                  disabled={!canManage || savingPlatformSettings}
                >
                  <span className="switch-knob"></span>
                </button>
              </div>
              <div className="sharah-platform-menu-row">
                <span>تيك توك</span>
                <button
                  type="button"
                  className={`switch-toggle${platformSettings.tiktok ? ' on' : ''}`}
                  aria-pressed={platformSettings.tiktok}
                  onClick={() => togglePlatform('tiktok')}
                  disabled={!canManage || savingPlatformSettings}
                >
                  <span className="switch-knob"></span>
                </button>
              </div>
            </div>
          ) : null}
        </div>
      </div>

      {activeSection === 'tags' && (
        <div className="sharah-tags-panel">
          <div className="card-header compact">
            <div>
              <h3>وسوم Shara</h3>
              <p className="muted">تحكم بوسوم شائع الظاهرة على صفحة Shara، وأضف الوسوم التي تريد استخدامها على الريلز.</p>
            </div>
            <div className="row">
              <button type="button" onClick={() => setShowAddTags(true)} disabled={!canManage || savingAdminTags}>Add Tags</button>
            </div>
          </div>
          <div className="sharah-popular-tags-panel">
            <div className="card-header compact">
              <div>
                <h4>وسوم شائع على صفحة Shara</h4>
                <p className="muted">يبدأ فارغاً. أضف فقط الوسوم التي تريد ظهورها في صف شائع.</p>
              </div>
              <button type="button" className={popularSettings.enabled ? 'secondary' : ''} onClick={togglePopularSection} disabled={!canManage || savingPopularTags}>{popularSettings.enabled ? 'إخفاء شائع' : 'إظهار شائع'}</button>
            </div>
            <div className="sharah-tag-add-row sharah-tag-selector">
              <div className="sharah-tag-select-wrap">
                <input
                  value={popularTagInput}
                  onChange={(event) => { setPopularTagInput(event.target.value); setShowPopularTagOptions(true); }}
                  onFocus={() => setShowPopularTagOptions(true)}
                  onBlur={() => window.setTimeout(() => setShowPopularTagOptions(false), 120)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter') {
                      event.preventDefault();
                      addPopularTag();
                    }
                    if (event.key === 'Escape') setShowPopularTagOptions(false);
                  }}
                  placeholder="اختر وسم موجود"
                  disabled={!canManage || savingPopularTags}
                />
                {showPopularTagOptions && canManage && !savingPopularTags ? (
                  <div className="sharah-tag-options" role="listbox">
                    {filteredPopularTagOptions.length > 0 ? filteredPopularTagOptions.map((tag) => (
                      <button key={tag} type="button" onMouseDown={(event) => event.preventDefault()} onClick={() => { setPopularTagInput(tag); setShowPopularTagOptions(false); }}>
                        {tag}
                      </button>
                    )) : <span className="muted">لا توجد وسوم مطابقة</span>}
                  </div>
                ) : null}
              </div>
              <button type="button" onClick={addPopularTag} disabled={!canManage || savingPopularTags || !popularTagInput.trim() || !availablePopularTags.includes(popularTagInput.trim())}>إضافة</button>
            </div>
            <div className="sharah-popular-tag-list">
              {popularSettings.tags.length > 0 ? popularSettings.tags.map((item) => (
                <div key={item.tag} className={`sharah-popular-tag${item.hidden ? ' hidden' : ''}`}>
                  <span>{item.tag}</span>
                  <small>{item.hidden ? 'مخفي' : 'ظاهر'}</small>
                  <button type="button" className="secondary small" onClick={() => togglePopularTag(item.tag)} disabled={!canManage || savingPopularTags}>{item.hidden ? 'إظهار' : 'إخفاء'}</button>
                  <button type="button" className="secondary small danger" onClick={() => deletePopularTag(item.tag)} disabled={!canManage || savingPopularTags}>حذف</button>
                </div>
              )) : <p className="muted">لا توجد وسوم شائع. أضف وسم لعرضه في الصفحة.</p>}
            </div>
          </div>
          {tagStats.length === 0 && !loading ? <p className="muted">لا توجد وسوم بعد. اضغط Add Tags لإضافة أول وسم.</p> : null}
          <div className="sharah-tag-cloud">
            {tagStats.map(({ tag, count }) => (
              <button key={tag} type="button" className="sharah-tag-pill" onClick={() => { setQuery(tag); setActiveSection('reels'); }}>
                <span>{tag}</span>
                <small>{count}</small>
              </button>
            ))}
          </div>
        </div>
      )}

      {activeSection === 'reels' && (
        <div className="sharah-reels-panel">
          <div className="sharah-reels-toolbar">
            <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="ابحث بالوسم" />
            {query.trim() ? <button type="button" className="secondary" onClick={() => setQuery('')}>عرض كل الريلز</button> : null}
            <span className="muted">{filteredReels.length} من {reels.length} ريل | ظاهر {reels.filter((reel) => !reel.hidden).length} | مخفي {reels.filter((reel) => reel.hidden).length}</span>
          </div>
          <div className="sharah-reel-filters" aria-label="فلاتر الريلز">
            <div className="sharah-filter-tabs" role="group" aria-label="فلتر المنصة">
              <button type="button" className={platformFilter === 'all' ? 'active' : ''} onClick={() => setPlatformFilter('all')}>كل المنصات</button>
              <button type="button" className={platformFilter === 'facebook' ? 'active' : ''} onClick={() => setPlatformFilter('facebook')}>Facebook</button>
              <button type="button" className={platformFilter === 'tiktok' ? 'active' : ''} onClick={() => setPlatformFilter('tiktok')}>TikTok</button>
            </div>
            <div className="sharah-filter-tabs" role="group" aria-label="فلتر الظهور">
              <button type="button" className={visibilityFilter === 'all' ? 'active' : ''} onClick={() => setVisibilityFilter('all')}>كل الظهور</button>
              <button type="button" className={visibilityFilter === 'visible' ? 'active' : ''} onClick={() => setVisibilityFilter('visible')}>الظاهرة</button>
              <button type="button" className={visibilityFilter === 'hidden' ? 'active' : ''} onClick={() => setVisibilityFilter('hidden')}>المخفية</button>
            </div>
            <div className="sharah-filter-tabs" role="group" aria-label="فلتر الوسوم">
              <button type="button" className={tagFilter === 'all' ? 'active' : ''} onClick={() => setTagFilter('all')}>كل الريلز</button>
              <button type="button" className={tagFilter === 'tagged' ? 'active' : ''} onClick={() => setTagFilter('tagged')}>Tagged</button>
              <button type="button" className={tagFilter === 'untagged' ? 'active' : ''} onClick={() => setTagFilter('untagged')}>Untagged</button>
            </div>
          </div>
          {query.trim() && filteredReels.length === 0 ? (
            <p className="notice">لا توجد ريلز مطابقة للبحث الحالي. اضغط "عرض كل الريلز" لإزالة الفلتر.</p>
          ) : null}
          <div className="sharah-reel-grid">
            {filteredReels.map((reel) => (
              <article key={`${reel.platform}-${reel.id}`} className={`sharah-reel-card${reel.hidden ? ' hidden' : ''}`}>
                <div className="sharah-reel-actions">
                  <button type="button" className="small" onClick={() => setEditingReel(reel)} disabled={!canManage} title={canManage ? 'تعديل الوسوم' : 'لا تملك صلاحية الإدارة'}>+</button>
                  <span className="sharah-platform">{reel.platform === 'tiktok' ? 'TikTok' : 'Facebook'}</span>
                </div>
                {reel.hidden ? <span className="sharah-hidden-badge">مخفي</span> : null}
                {reel.thumbnail ? <img src={reel.thumbnail} alt="" /> : <div className="sharah-reel-placeholder">بدون صورة</div>}
                <h3>{reel.title}</h3>
                <div className="sharah-tag-list">
                  {normalizeTags(reel.tags).length > 0 ? normalizeTags(reel.tags).map((tag) => <span key={tag} className="sharah-tag-chip">{tag}</span>) : <span className="muted">لا توجد وسوم</span>}
                </div>
                <div className="row">
                  <button type="button" className={reel.hidden ? 'small' : 'secondary small'} onClick={() => toggleVisibility(reel)} disabled={!canManage || savingVisibilityKey === `${reel.platform}-${reel.id}`}>
                    {savingVisibilityKey === `${reel.platform}-${reel.id}` ? 'جارٍ الحفظ...' : reel.hidden ? 'إظهار' : 'إخفاء'}
                  </button>
                  {reel.url ? <a href={reel.url} target="_blank" rel="noreferrer" className="secondary small">فتح الريل</a> : null}
                </div>
              </article>
            ))}
          </div>
        </div>
      )}

      {showAddTags && <AddTagsDialog onClose={() => setShowAddTags(false)} onSave={(nextTags) => { addGlobalTags(nextTags); setShowAddTags(false); }} />}
      {showAddReel && <AddReelDialog saving={saving} onClose={() => setShowAddReel(false)} onSave={addReel} />}
      <SharaTagDialog reel={editingReel} tags={allTags} saving={saving} onAddGlobalTags={addGlobalTags} onClose={() => setEditingReel(null)} onSave={saveTags} />
    </section>
  );
}
