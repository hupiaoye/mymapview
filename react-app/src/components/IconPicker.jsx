/**
 * IconPicker — 图标选择器组件
 * 网格展示内置图标库，支持分类筛选、搜索、选中预览。
 * 用于标注编辑弹窗中选择图标。
 */
import React, { useState, useMemo, useRef, useEffect } from 'react';
import { ICON_LIBRARY, ICON_CATEGORIES, getIconById } from '../utils/iconLibrary';

export default function IconPicker({ value, onChange }) {
  const [search, setSearch] = useState('');
  const [activeCategory, setActiveCategory] = useState('all');
  const scrollRef = useRef(null);

  // 过滤图标
  const filtered = useMemo(() => {
    let list = ICON_LIBRARY;
    if (activeCategory !== 'all') {
      list = list.filter(i => i.category === activeCategory);
    }
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      list = list.filter(i =>
        i.name.includes(q) || i.id.includes(q) ||
        ICON_CATEGORIES.find(c => c.id === i.category)?.name.includes(q)
      );
    }
    return list;
  }, [search, activeCategory]);

  // 当前选中
  const selected = getIconById(value);

  // 自动滚动到选中项
  useEffect(() => {
    if (scrollRef.current && value) {
      const el = scrollRef.current.querySelector(`[data-icon-id="${value}"]`);
      if (el) el.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    }
  }, [value, activeCategory]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      {/* 搜索栏 */}
      <input
        type="text"
        placeholder="搜索图标..."
        value={search}
        onChange={e => setSearch(e.target.value)}
        style={{
          width: '100%', padding: '7px 10px',
          border: '1px solid #e2e8f0', borderRadius: 6,
          fontSize: 12, boxSizing: 'border-box',
          outline: 'none', fontFamily: 'inherit'
        }}
        onFocus={e => { e.target.style.borderColor = '#2563eb'; e.target.style.boxShadow = '0 0 0 3px rgba(37,99,235,.12)'; }}
        onBlur={e => { e.target.style.borderColor = '#e2e8f0'; e.target.style.boxShadow = 'none'; }}
      />

      {/* 分类标签 */}
      <div style={{
        display: 'flex', flexWrap: 'wrap', gap: 4,
        padding: '4px 0', borderBottom: '1px solid #e2e8f0'
      }}>
        <button
          onClick={() => setActiveCategory('all')}
          style={{
            padding: '3px 10px', fontSize: 11, border: '1px solid #e2e8f0',
            borderRadius: 12, cursor: 'pointer', background: activeCategory === 'all' ? '#2563eb' : '#fff',
            color: activeCategory === 'all' ? '#fff' : '#475569',
            transition: 'all 0.15s'
          }}
        >全部 ({ICON_LIBRARY.length})</button>
        {ICON_CATEGORIES.map(cat => {
          const count = ICON_LIBRARY.filter(i => i.category === cat.id).length;
          const catColor = cat.id === 'pin' ? '#E91E63' : cat.id === 'location' ? '#2196F3' : '#64748b';
          return (
            <button key={cat.id}
              onClick={() => setActiveCategory(cat.id)}
              style={{
                padding: '3px 10px', fontSize: 11, border: '1px solid #e2e8f0',
                borderRadius: 12, cursor: 'pointer',
                background: activeCategory === cat.id ? catColor : '#fff',
                color: activeCategory === cat.id ? '#fff' : '#64748b',
                transition: 'all 0.15s'
              }}
            >{cat.name} ({count})</button>
          );
        })}
      </div>

      {/* 当前选中预览 */}
      {selected && (
        <div style={{
          display: 'flex', alignItems: 'center', gap: 8,
          padding: '7px 9px', background: '#f8fafc', borderRadius: 6,
          border: '1px solid #e2e8f0'
        }}>
          <span style={{
            width: 28, height: 28, display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 20
          }} dangerouslySetInnerHTML={{ __html: selected.svg }} />
          <span style={{ fontSize: 12, fontWeight: 500, color: '#333' }}>{selected.name}</span>
          <span style={{ fontSize: 10, color: '#999' }}>（{selected.category}）</span>
        </div>
      )}

      {/* 图标网格 */}
      <div ref={scrollRef} style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fill, minmax(36px, 1fr))',
        gap: 3,
        maxHeight: 260,
        overflowY: 'auto',
        padding: 4,
        border: '1px solid #eee',
        borderRadius: 4,
        background: '#fafafa'
      }}>
        {filtered.map(icon => (
          <button
            key={icon.id}
            data-icon-id={icon.id}
            title={`${icon.name} (${icon.id})`}
            onClick={() => onChange(icon.id)}
            style={{
              width: 34, height: 34,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              border: value === icon.id ? '2px solid #2563eb' : '1px solid transparent',
              borderRadius: 6,
              background: value === icon.id ? '#eff6ff' : 'transparent',
              cursor: 'pointer',
              padding: 2,
              transition: 'all 0.12s',
              position: 'relative'
            }}
            onMouseEnter={e => { if (value !== icon.id) e.currentTarget.style.background = '#f1f5f9'; }}
            onMouseLeave={e => { if (value !== icon.id) e.currentTarget.style.background = 'transparent'; }}
          >
            <span
              dangerouslySetInnerHTML={{ __html: icon.svg }}
              style={{
                width: 24, height: 24, display: 'flex',
                alignItems: 'center', justifyContent: 'center',
                color: icon.color
              }}
            />
          </button>
        ))}
      </div>

      {filtered.length === 0 && (
        <div style={{ textAlign: 'center', padding: 16, color: '#999', fontSize: 12 }}>
          未找到匹配的图标
        </div>
      )}
    </div>
  );
}
