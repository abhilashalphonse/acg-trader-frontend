import React, { useEffect, useRef, useState } from 'react';
import { Camera, ImageOff, Save, UserRound } from 'lucide-react';
import { useTraderProfile } from '../../hooks/useTraderProfile.js';
import { compressShareProfileImage } from '../../utils/profileImage.js';

export default function ShareProfileEditor({ compact = false }) {
  const inputRef = useRef(null);
  const { profile, loading, saving, error, save } = useTraderProfile();
  const [draft, setDraft] = useState({ displayName: 'Trader', sharePhotoDataUrl: null, shareTemplate: 'PERFORMANCE' });
  const [notice, setNotice] = useState('');
  const [imageBusy, setImageBusy] = useState(false);

  useEffect(() => {
    setDraft({
      displayName: profile.displayName || 'Trader',
      sharePhotoDataUrl: profile.sharePhotoDataUrl || null,
      shareTemplate: profile.shareTemplate === 'PHOTO' ? 'PHOTO' : 'PERFORMANCE',
    });
  }, [profile.displayName, profile.sharePhotoDataUrl, profile.shareTemplate]);

  const choosePhoto = async event => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    setImageBusy(true);
    setNotice('');
    try {
      const sharePhotoDataUrl = await compressShareProfileImage(file);
      setDraft(current => ({ ...current, sharePhotoDataUrl }));
    } catch (nextError) {
      setNotice(nextError?.message || 'Unable to prepare this image.');
    } finally {
      setImageBusy(false);
    }
  };

  const commit = async () => {
    const displayName = String(draft.displayName || '').trim();
    if (!displayName) return setNotice('Enter a display name.');
    setNotice('');
    try {
      await save({
        displayName,
        sharePhotoDataUrl: draft.sharePhotoDataUrl || null,
        shareTemplate: draft.shareTemplate === 'PHOTO' ? 'PHOTO' : 'PERFORMANCE',
      });
      setNotice('Share profile saved.');
    } catch (nextError) {
      setNotice(nextError?.message || 'Unable to save share profile.');
    }
  };

  return (
    <section className={compact ? 'border-t border-white/[0.08] pt-3' : ''}>
      <div className="mb-2">
        <b className="text-[10px] text-[#e5e5e5]">P&amp;L share profile</b>
        <p className="mt-1 text-[8px] leading-4 text-[#737373]">Name, photo and template used when sharing an open position.</p>
      </div>

      <div className="flex items-center gap-3">
        <div className="size-14 shrink-0 overflow-hidden rounded-full border border-white/[0.12] bg-[#101010]">
          {draft.sharePhotoDataUrl
            ? <img src={draft.sharePhotoDataUrl} alt="" className="h-full w-full object-cover" />
            : <div className="grid h-full w-full place-items-center text-[#737373]"><UserRound size={22}/></div>}
        </div>
        <div className="min-w-0 flex-1">
          <span className="text-[7px] font-bold uppercase tracking-[0.1em] text-[#737373]">Display name</span>
          <input
            value={draft.displayName}
            onChange={event => setDraft(current => ({ ...current, displayName: event.target.value.slice(0, 64) }))}
            maxLength={64}
            className="mt-1 h-9 w-full rounded-md border border-white/[0.08] bg-black px-3 text-[10px] font-semibold text-[#f5f5f5] outline-none focus:border-white/[0.18]"
          />
        </div>
      </div>

      <input ref={inputRef} type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={choosePhoto} />
      <div className="mt-3 grid grid-cols-2 gap-2">
        <button type="button" disabled={imageBusy} onClick={() => inputRef.current?.click()} className="flex h-9 items-center justify-center gap-1.5 rounded-md border border-white/[0.09] bg-black text-[9px] font-bold text-[#d4d4d4] disabled:opacity-40"><Camera size={12}/>{imageBusy ? 'Preparing…' : draft.sharePhotoDataUrl ? 'Change photo' : 'Add photo'}</button>
        <button type="button" disabled={!draft.sharePhotoDataUrl} onClick={() => setDraft(current => ({ ...current, sharePhotoDataUrl: null, shareTemplate: 'PERFORMANCE' }))} className="flex h-9 items-center justify-center gap-1.5 rounded-md border border-white/[0.09] bg-black text-[9px] font-bold text-[#a3a3a3] disabled:opacity-35"><ImageOff size={12}/>Remove</button>
      </div>

      <div className="mt-3 grid grid-cols-2 gap-2">
        <button type="button" onClick={() => setDraft(current => ({ ...current, shareTemplate: 'PERFORMANCE' }))} className={'h-10 rounded-md border text-[9px] font-bold ' + (draft.shareTemplate === 'PERFORMANCE' ? 'border-[#53c7ff] text-[#53c7ff]' : 'border-white/[0.08] text-[#a3a3a3]')}>Performance</button>
        <button type="button" disabled={!draft.sharePhotoDataUrl} onClick={() => setDraft(current => ({ ...current, shareTemplate: 'PHOTO' }))} className={'h-10 rounded-md border text-[9px] font-bold disabled:opacity-35 ' + (draft.shareTemplate === 'PHOTO' ? 'border-[#53c7ff] text-[#53c7ff]' : 'border-white/[0.08] text-[#a3a3a3]')}>Photo</button>
      </div>

      <p className="mt-2 text-[8px] leading-4 text-[#737373]">{draft.shareTemplate === 'PHOTO' && draft.sharePhotoDataUrl ? 'Your selected photo is used as the poster background and avatar.' : 'Your photo is used as the avatar on the ACG performance poster.'}</p>
      {(notice || error) && <div className="mt-2 text-[8px] leading-4 text-[#a3a3a3]">{notice || error?.message}</div>}

      <button type="button" disabled={loading || saving || imageBusy} onClick={commit} className="mt-3 flex h-9 w-full items-center justify-center gap-2 rounded-md border border-white/[0.10] bg-[#101010] text-[9px] font-black text-[#f5f5f5] disabled:opacity-40"><Save size={12}/>{saving ? 'Saving…' : 'Save share profile'}</button>
    </section>
  );
}
