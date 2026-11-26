export default function RefreshButton({ refreshing, onRefresh, aboveNavigation = false }) {
  return (
    <button
      className={`refresh-icon${aboveNavigation ? ' refresh-icon-above-navigation' : ''}${refreshing ? ' is-refreshing' : ''}`}
      type="button"
      aria-label={refreshing ? 'Refreshing news' : 'Refresh news'}
      title="Refresh news"
      disabled={refreshing}
      onClick={onRefresh}
    >
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M21 2v6h-6" />
        <path d="M3 12a9 9 0 0 1 15.6-6.2L21 8" />
        <path d="M3 12a9 9 0 0 0 15.6 6.2" />
      </svg>
    </button>
  );
}
