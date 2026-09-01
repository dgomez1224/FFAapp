import React from "react";
import { Card } from "../ui/card";
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselNext,
  CarouselPrevious,
} from "../ui/carousel";
import { cn } from "../ui/utils";

type DashboardCarouselProps = {
  title?: string;
  subtitle?: React.ReactNode;
  header?: React.ReactNode;
  empty?: React.ReactNode;
  children: React.ReactNode;
  itemClassName?: string;
  className?: string;
};

export function DashboardCarousel({
  title,
  subtitle,
  header,
  empty,
  children,
  itemClassName,
  className,
}: DashboardCarouselProps) {
  const items = React.Children.toArray(children).filter(Boolean);

  return (
    <Card className={cn("overflow-hidden p-4", className)}>
      {header ?? (
        <div className="mb-3">
          {title ? <h2 className="text-lg font-semibold">{title}</h2> : null}
          {subtitle}
        </div>
      )}
      {items.length === 0 ? (
        empty ?? <p className="text-sm text-muted-foreground">Nothing to show yet.</p>
      ) : (
        <Carousel
          opts={{ align: "start", dragFree: true, containScroll: "trimSnaps" }}
          className="w-full"
        >
          <CarouselContent className="-ml-3">
            {items.map((child, index) => (
              <CarouselItem
                key={index}
                className={cn(
                  "pl-3 basis-[85%] sm:basis-[55%] md:basis-[45%] lg:basis-[32%]",
                  itemClassName,
                )}
              >
                {child}
              </CarouselItem>
            ))}
          </CarouselContent>
          <CarouselPrevious className="left-1 size-8 border bg-background/90 shadow-sm disabled:opacity-30" />
          <CarouselNext className="right-1 size-8 border bg-background/90 shadow-sm disabled:opacity-30" />
        </Carousel>
      )}
    </Card>
  );
}
