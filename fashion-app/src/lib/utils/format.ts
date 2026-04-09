export const formatDateTime = (value?: string | null) => {
  if (!value) {
    return '-';
  }

  return new Date(value).toLocaleString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
};

export const maskApiKey = (value: string) => {
  if (value.length <= 10) {
    return value;
  }

  return `${value.slice(0, 6)}...${value.slice(-4)}`;
};
