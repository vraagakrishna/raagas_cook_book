interface UrlFormatInput {
  query?: Record<string, string | number | boolean>;
}

const browserUrl = {
  format({ query = {} }: UrlFormatInput) {
    const search = new URLSearchParams(
      Object.entries(query).map(([key, value]) => [key, String(value)]),
    );
    const value = search.toString();
    return value ? `?${value}` : "";
  },
};

export default browserUrl;
