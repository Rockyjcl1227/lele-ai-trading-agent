window.AppState = {
  activeNav: "market",
  view: "quote",
  chartTab: "分时",
  bookTab: "五档",
  newsTab: "要闻",
  watchSort: "default",
  loading: true,
  error: "",
  modal: null,
  toast: "",
  searchQuery: "",
  watchlisted: true,
  listeners: [],
  set(patch) {
    Object.assign(this, patch);
    this.listeners.forEach((listener) => listener(this));
  },
  subscribe(listener) {
    this.listeners.push(listener);
    return () => {
      this.listeners = this.listeners.filter((item) => item !== listener);
    };
  }
};
