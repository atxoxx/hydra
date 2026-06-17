"""Append news + crackwatch i18n keys to every locale JSON file under src/locales/."""
import json
import os
from pathlib import Path

ROOT = Path(r"D:\Developement\test\hydra\src\locales")

# crackwatch keys (go into game_details namespace)
CRACKWATCH_BLOCK = {
    "media": "Media",
    "crackwatch_status": "CrackWatch",
    "cracked": "Cracked",
    "uncracked": "Uncracked",
    "crack_group": "Group",
    "crack_date": "Crack date",
    "protection": "Protection",
}

# sidebar slot
SIDEBAR_NEWS_KEY = {"news": "News"}

# news namespace block
NEWS_BLOCK = {
    "news": "News",
    "news_search_label": "Search articles",
    "news_search_placeholder": "Search feeds\u2026",
    "news_refresh": "Refresh",
    "news_mark_all": "Mark all read",
    "news_settings": "Settings",
    "news_show_only_unread": "Show only unread",
    "news_show_all_sources": "Show all sources",
    "news_unread_badge_one": "{{count}} unread",
    "news_unread_badge_other": "{{count}} unread",
    "news_loading": "Loading articles\u2026",
    "news_empty": "No articles match the current filter",
    "news_empty_filtered": "No feeds configured yet",
    "news_add_first_feed": "Add your first feed",
    "news_refresh_failed": "Could not refresh feeds: {{message}}",
    "news_mark_all_done": "Marked {{count}} articles as read",
    "news_mark_all_failed": "Could not mark all read",
    "news_open_external_failed": "Could not open external browser",
    "news_open_inline": "Open inline",
    "news_open_external": "Open in browser",
    "news_close": "Close",
    "news_mark_read_aria": "Mark as read",
    "news_settings_modal_title": "News feed settings",
    "news_settings_modal_description": "Manage RSS subscriptions, defaults, and read history",
    "news_add_feed": "Add a feed",
    "news_add_feed_url_label": "Feed URL",
    "news_add_feed_label_label": "Label (optional)",
    "news_add_feed_label_placeholder": "My favourite site",
    "news_add_feed_submit": "Add feed",
    "news_add_feed_invalid": "Please enter a valid http(s) URL",
    "news_add_feed_failed": "Could not add feed: {{message}}",
    "news_add_feed_success": "Feed added",
    "news_add_feed_exists": "That feed is already in your list",
    "news_remove_failed": "Could not remove feed: {{message}}",
    "news_toggle_failed": "Could not toggle feed: {{message}}",
    "news_history_section": "Read history",
    "news_history_cleared": "Read history cleared",
    "news_history_clear_failed": "Could not clear read history: {{message}}",
    "news_settings_load_failed": "Could not load feeds: {{message}}",
    "news_settings_clear_history": "Clear all read history",
    "news_subscribed_feeds": "Subscribed feeds",
    "news_no_feeds_subscribed": "You are not subscribed to any feeds yet.",
    "news_default_feed_hint": "Default feeds include: {{labels}}",
    "news_feed_error_short": "error",
    "news_feed_default_badge": "default",
    "news_feed_remove": "Remove feed",
    "news_settings_help": "Configure whether the News tab appears in the top navigation and how unread articles are surfaced.",
    "news_settings_section": "News",
    "news_show_news_tab": "Show the News tab",
    "news_only_unread_default": "Show only unread articles by default",
    "news_inline_blocked_title": "Couldn't load the article inline",
    "news_inline_blocked_body": "We couldn't load this publisher's article inline. The excerpt below is from the RSS feed; use the button above to read the full piece on their site.",
    "news_inline_retry": "Retry inline preview",
    "news_chip_all": "All",
    "news_chip_unread": "Unread",
    "news_filter_aria": "Filter articles by source or status",
}

# settings news keys
SETTINGS_NEWS_BLOCK = {
    "news": "News",
    "news_show_news_tab": "Show News tab",
    "news_only_unread_default": "Show only unread articles",
    "news_settings_section": "News",
    "news_settings_help": "Decide whether to show the News tab and how unread articles are surfaced by default.",
    "sidebar_show_news_tab": "Show News tab",
}


def deep_merge(base, additions):
    for key, value in additions.items():
        if (
            key in base
            and isinstance(base[key], dict)
            and isinstance(value, dict)
        ):
            deep_merge(base[key], value)
        else:
            if key not in base:
                base[key] = value


def main():
    locales = [p for p in ROOT.iterdir() if p.is_dir()]
    updated = []
    skipped = []
    for loc_dir in sorted(locales):
        tr_file = loc_dir / "translation.json"
        if not tr_file.exists():
            skipped.append(loc_dir.name)
            continue
        try:
            with tr_file.open("r", encoding="utf-8") as fh:
                data = json.load(fh)
        except Exception as exc:  # noqa: BLE001
            print(f"!! {loc_dir.name}: failed to load: {exc}")
            skipped.append(loc_dir.name)
            continue

        # crackwatch into game_details
        game_details = data.setdefault("game_details", {})
        deep_merge(game_details, CRACKWATCH_BLOCK)

        # sidebar.news
        sidebar = data.setdefault("sidebar", {})
        deep_merge(sidebar, SIDEBAR_NEWS_KEY)

        # settings keys (sidebar_show_news_tab goes there too)
        settings = data.setdefault("settings", {})
        deep_merge(settings, SETTINGS_NEWS_BLOCK)

        # news namespace
        news_ns = data.setdefault("news", {})
        deep_merge(news_ns, NEWS_BLOCK)

        with tr_file.open("w", encoding="utf-8") as fh:
            json.dump(data, fh, ensure_ascii=False, indent=2)
            fh.write("\n")
        updated.append(loc_dir.name)
    print(f"updated: {len(updated)}")
    print(f"skipped: {len(skipped)} -> {skipped}")


if __name__ == "__main__":
    main()
