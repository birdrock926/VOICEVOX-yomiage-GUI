import { useState } from 'react';

export default function SpeakerSelector({ speakers, selectedId, onChange, favorites = [], onToggleFavorite }) {
  const [searchQuery, setSearchQuery] = useState('');
  const [filterCategory, setFilterCategory] = useState('all');
  const [isOpen, setIsOpen] = useState(false);

  const getAllStyles = () => {
    const styles = [];
    speakers.forEach(speaker => {
      speaker.styles.forEach(style => {
        styles.push({
          id: style.id,
          name: `${speaker.name}（${style.name}）`,
          speakerName: speaker.name,
          styleName: style.name,
          speaker_uuid: speaker.speaker_uuid,
          isFavorite: favorites.includes(style.id)
        });
      });
    });
    return styles;
  };

  const getFilteredStyles = () => {
    let styles = getAllStyles();

    if (filterCategory === 'favorites') {
      styles = styles.filter(s => s.isFavorite);
    } else if (filterCategory === 'zundamon') {
      styles = styles.filter(s => s.speakerName.includes('ずんだもん'));
    } else if (filterCategory === 'other') {
      styles = styles.filter(s => !s.speakerName.includes('ずんだもん'));
    }

    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      styles = styles.filter(s =>
        s.name.toLowerCase().includes(query) ||
        s.speakerName.toLowerCase().includes(query) ||
        s.styleName.toLowerCase().includes(query)
      );
    }

    return styles;
  };

  const filteredStyles = getFilteredStyles();
  const selectedStyle = getAllStyles().find(s => s.id === selectedId);

  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="input w-full flex items-center justify-between"
      >
        <div className="flex items-center gap-2">
          {selectedStyle?.isFavorite && <span className="text-yellow-500">⭐</span>}
          <span>{selectedStyle?.name || '話者を選択'}</span>
        </div>
        <span className="text-gray-400">{isOpen ? '▲' : '▼'}</span>
      </button>

      {isOpen && (
        <div className="absolute z-50 mt-2 w-full bg-gray-800 border border-gray-700 rounded-lg shadow-2xl max-h-96 flex flex-col">
          <div className="p-3 border-b border-gray-700 space-y-2">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="話者を検索..."
              className="input text-sm"
              onClick={(e) => e.stopPropagation()}
            />

            <div className="flex gap-2">
              <button
                onClick={() => setFilterCategory('all')}
                className={`px-3 py-1 rounded text-xs ${
                  filterCategory === 'all' ? 'bg-zundamon-600' : 'bg-gray-700'
                }`}
              >
                すべて
              </button>
              <button
                onClick={() => setFilterCategory('favorites')}
                className={`px-3 py-1 rounded text-xs ${
                  filterCategory === 'favorites' ? 'bg-yellow-600' : 'bg-gray-700'
                }`}
              >
                ⭐ お気に入り
              </button>
              <button
                onClick={() => setFilterCategory('zundamon')}
                className={`px-3 py-1 rounded text-xs ${
                  filterCategory === 'zundamon' ? 'bg-zundamon-600' : 'bg-gray-700'
                }`}
              >
                ずんだもん
              </button>
              <button
                onClick={() => setFilterCategory('other')}
                className={`px-3 py-1 rounded text-xs ${
                  filterCategory === 'other' ? 'bg-gray-600' : 'bg-gray-700'
                }`}
              >
                その他
              </button>
            </div>
          </div>

          <div className="overflow-y-auto flex-1">
            {filteredStyles.length === 0 ? (
              <div className="p-4 text-center text-gray-500">
                該当する話者が見つかりません
              </div>
            ) : (
              filteredStyles.map(style => (
                <div
                  key={style.id}
                  className={`px-3 py-2 cursor-pointer flex items-center justify-between hover:bg-gray-700 ${
                    style.id === selectedId ? 'bg-gray-700' : ''
                  }`}
                  onClick={() => {
                    onChange(style.id);
                    setIsOpen(false);
                  }}
                >
                  <div className="flex items-center gap-2">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onToggleFavorite(style.id);
                      }}
                      className="text-lg hover:scale-110 transition-transform"
                    >
                      {style.isFavorite ? '⭐' : '☆'}
                    </button>
                    <span className="text-sm">{style.name}</span>
                  </div>
                  {style.id === selectedId && (
                    <span className="text-zundamon-500 text-sm">✓</span>
                  )}
                </div>
              ))
            )}
          </div>

          <div className="p-2 border-t border-gray-700 text-xs text-gray-400 text-center">
            {filteredStyles.length} 件の話者
          </div>
        </div>
      )}
    </div>
  );
}
