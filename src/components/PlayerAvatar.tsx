import React from "react";
import {
  getPlayerInitialsAbbrev,
  getProxiedImageUrl,
  handlePlayerImageErrorWithWikipediaFallback,
} from "../lib/playerImage";

type PlayerAvatarProps = {
  name: string;
  imageUrl?: string | null;
  size?: "sm" | "md" | "lg";
  className?: string;
};

const SIZE = {
  sm: "h-8 w-8 text-[9px]",
  md: "h-10 w-10 text-[10px]",
  lg: "h-12 w-12 text-xs",
};

export function PlayerAvatar({ name, imageUrl, size = "md", className = "" }: PlayerAvatarProps) {
  const box = SIZE[size];
  const src = getProxiedImageUrl(imageUrl);
  return (
    <div className={`relative shrink-0 overflow-hidden rounded-full border bg-muted ${box} ${className}`}>
      {src ? (
        <img
          src={src}
          alt={name}
          className="h-full w-full object-cover"
          onError={(e) =>
            handlePlayerImageErrorWithWikipediaFallback(e, name, {
              fallbackClassName:
                "absolute inset-0 flex items-center justify-center bg-muted font-bold text-muted-foreground",
            })
          }
        />
      ) : (
        <span className="flex h-full w-full items-center justify-center font-bold text-muted-foreground">
          {getPlayerInitialsAbbrev(name)}
        </span>
      )}
    </div>
  );
}
