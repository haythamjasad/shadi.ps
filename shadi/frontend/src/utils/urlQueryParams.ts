import { QueryObj } from "@/types/utils";

export const getUrlQueryObj = (url: URL): QueryObj => {
  const urlQuery = new URLSearchParams(url.search);
  const queryObj: QueryObj = {};

  urlQuery.forEach((value, key) => {
    queryObj[key] = value;
  });

  return queryObj;
};

export const getUrlQueryString = (
  baseUrl: string,
  params: Record<string, string>
) => {
  const searchParams = new URLSearchParams(params);
  return `${baseUrl}?${searchParams.toString()}`;
};
