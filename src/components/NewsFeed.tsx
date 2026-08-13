"use client";

import { useEffect, useState } from "react";

interface NewsItem {
  uuid: string;
  title: string;
  description: string;
  source: string;
  published_at: string;
  url: string;
}

export default function NewsFeed() {
  const [news, setNews] = useState<NewsItem[]>([]);

  useEffect(() => {
    async function fetchNews() {
      try {
        const res = await fetch("/api/news");
        const json = await res.json();
        setNews(json.data || []);
      } catch (error) {
        console.error("Failed to load news", error);
      }
    }

    fetchNews();
  }, []);

  return (
    <div className="panel p-6">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-lg font-semibold text-[#E5E7EB]">
          Gold market news
        </h2>
        <span className="text-xs text-[#8891A0]">
          Live
        </span>
      </div>

      <div className="space-y-4">
        {news.length === 0 ? (
          <p className="text-sm text-[#8891A0]">Loading news...</p>
        ) : (
          news.map((item) => (
            <a
              key={item.uuid}
              href={item.url}
              target="_blank"
              rel="noreferrer"
              className="block rounded-xl border border-[#23262F] p-4 hover:border-[#3B82F6]"
            >
              <p className="text-sm font-semibold text-[#E5E7EB]">
                {item.title}
              </p>
              <p className="mt-1 text-xs text-[#8891A0]">
                {item.description}
              </p>
              <div className="mt-3 flex items-center justify-between text-[11px] text-[#6B7280]">
                <span>{item.source}</span>
                <span>
                  {new Date(item.published_at).toLocaleString()}
                </span>
              </div>
            </a>
          ))
        )}
      </div>
    </div>
  );
          }
