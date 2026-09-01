import React, { useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { ChevronDown } from "lucide-react";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "../ui/collapsible";
import { cn } from "../ui/utils";

type NavItem = {
  label: string;
  path?: string;
  onClick?: () => void;
};

type NavGroup = {
  id: string;
  label: string;
  items: NavItem[];
};

type MainNavigationProps = {
  token: string | null;
  showCupFeatures: boolean;
  onSignOut: () => void;
};

function buildGroups(token: string | null, showCupFeatures: boolean, onSignOut: () => void): NavGroup[] {
  const clubhouseItems: NavItem[] = [
    { label: "Player Messages", path: "/messages" },
    { label: "Scouting", path: "/scouting" },
    { label: "My Page / Sign In", path: token ? "/my-page" : "/sign-in" },
  ];
  if (showCupFeatures) {
    clubhouseItems.push({ label: "Pick Captain", path: "/pick-captain" });
  }
  if (token) {
    clubhouseItems.push({ label: "Sign Out", onClick: onSignOut });
  }

  return [
    {
      id: "standings",
      label: "Standings",
      items: [
        { label: "Leagues", path: "/league-standings" },
        { label: "Goblet", path: "/goblet" },
        { label: "FFA Cup", path: "/bracket" },
      ],
    },
    {
      id: "league-hq",
      label: "League HQ",
      items: [
        { label: "Managers", path: "/managers" },
        { label: "Team Rosters", path: "/team-rosters" },
        { label: "Players", path: "/players" },
        { label: "Fixtures", path: "/fixtures" },
        { label: "News", path: "/news" },
      ],
    },
    {
      id: "clubhouse",
      label: "Clubhouse",
      items: clubhouseItems,
    },
    {
      id: "league-history",
      label: "League History",
      items: [
        { label: "Legacy", path: "/legacy-home" },
        { label: "Legacy GW", path: "/legacy-gameweek-standings" },
        { label: "Standings by GW", path: "/standings-by-gameweek" },
      ],
    },
  ];
}

function itemIsActive(pathname: string, path?: string) {
  if (!path) return false;
  return pathname === path || pathname.startsWith(`${path}/`);
}

function groupIsActive(pathname: string, items: NavItem[]) {
  return items.some((item) => itemIsActive(pathname, item.path));
}

function NavLinkButton({
  item,
  pathname,
  onNavigate,
  className,
}: {
  item: NavItem;
  pathname: string;
  onNavigate?: () => void;
  className?: string;
}) {
  const active = itemIsActive(pathname, item.path);
  const shared = cn(
    "block w-full rounded-sm px-3 py-2 text-left text-sm transition-colors hover:bg-accent hover:text-accent-foreground",
    active && "bg-accent/60 font-medium text-accent-foreground",
    className,
  );

  if (item.onClick) {
    return (
      <button
        type="button"
        className={shared}
        onClick={() => {
          item.onClick?.();
          onNavigate?.();
        }}
      >
        {item.label}
      </button>
    );
  }

  return (
    <Link to={item.path || "/"} className={shared} onClick={onNavigate}>
      {item.label}
    </Link>
  );
}

export function MainNavigation({ token, showCupFeatures, onSignOut }: MainNavigationProps) {
  const location = useLocation();
  const groups = buildGroups(token, showCupFeatures, onSignOut);
  const [openMobileId, setOpenMobileId] = useState<string | null>(null);

  return (
    <>
      <nav
        aria-label="Primary"
        className="hidden border-t bg-card/40 lg:block"
      >
        <div className="mx-auto grid max-w-6xl grid-cols-4">
          {groups.map((group) => {
            const active = groupIsActive(location.pathname, group.items);
            return (
              <div key={group.id} className="group relative">
                <button
                  type="button"
                  className={cn(
                    "flex h-11 w-full items-center justify-center gap-1.5 font-heading text-sm font-semibold uppercase tracking-wide text-foreground/90 transition-colors hover:bg-accent/60 hover:text-foreground",
                    active && "bg-accent/40 text-foreground",
                  )}
                  aria-haspopup="menu"
                >
                  {group.label}
                  <ChevronDown className="h-3.5 w-3.5 opacity-70 transition-transform group-hover:rotate-180 group-focus-within:rotate-180" />
                </button>
                <div className="invisible absolute left-0 top-full z-50 w-full min-w-[12rem] pt-1 opacity-0 transition group-hover:visible group-hover:opacity-100 group-focus-within:visible group-focus-within:opacity-100">
                  <div className="rounded-md border bg-popover py-1 text-popover-foreground shadow-md">
                    {group.items.map((item) => (
                      <NavLinkButton
                        key={item.label}
                        item={item}
                        pathname={location.pathname}
                      />
                    ))}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </nav>

      <nav aria-label="Primary" className="border-t lg:hidden">
        {groups.map((group) => {
          const open = openMobileId === group.id;
          const active = groupIsActive(location.pathname, group.items);
          return (
            <Collapsible
              key={group.id}
              open={open}
              onOpenChange={(next) => setOpenMobileId(next ? group.id : null)}
            >
              <CollapsibleTrigger
                className={cn(
                  "flex w-full items-center justify-between px-4 py-3 font-heading text-sm font-semibold uppercase tracking-wide",
                  active ? "bg-accent/30 text-foreground" : "text-foreground/90",
                )}
              >
                <span>{group.label}</span>
                <ChevronDown className={cn("h-4 w-4 shrink-0 transition-transform", open && "rotate-180")} />
              </CollapsibleTrigger>
              <CollapsibleContent>
                <div className="border-t bg-muted/30 px-2 py-1">
                  {group.items.map((item) => (
                    <NavLinkButton
                      key={item.label}
                      item={item}
                      pathname={location.pathname}
                      onNavigate={() => setOpenMobileId(null)}
                    />
                  ))}
                </div>
              </CollapsibleContent>
            </Collapsible>
          );
        })}
      </nav>
    </>
  );
}
