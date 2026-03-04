"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import Image from "next/image";

const IMAGES = [
  { src: "/images/cleaning-house.png", alt: "House cleaning" },
  { src: "/images/car-washing.png", alt: "Car washing" },
  { src: "/images/commercial-clean.png", alt: "Commercial cleaning" },
];

const POSITIONS = [
  { x: "50%", y: "62%", size: "clamp(14rem, 19vw, 18rem)" },
  { x: "30%", y: "24%", size: "clamp(10.5rem, 14vw, 13.5rem)" },
  { x: "70%", y: "22%", size: "clamp(11rem, 15vw, 14rem)" },
];

const Z_ORDER = [30, 10, 20];

export default function HeroImages() {
  const [rotation, setRotation] = useState(0);
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);
  const holdTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isHolding = useRef(false);

  const rotate = useCallback(() => {
    setRotation((r) => (r + 1) % 3);
  }, []);

  const startHold = useCallback(() => {
    isHolding.current = true;
    holdTimer.current = setTimeout(() => {
      if (isHolding.current) {
        rotate();
      }
    }, 500);
  }, [rotate]);

  const endHold = useCallback(() => {
    isHolding.current = false;
    if (holdTimer.current) {
      clearTimeout(holdTimer.current);
      holdTimer.current = null;
    }
  }, []);

  useEffect(() => {
    return () => {
      if (holdTimer.current) clearTimeout(holdTimer.current);
    };
  }, []);

  const getImageIndex = (positionSlot: number) => {
    return (positionSlot + rotation) % 3;
  };

  return (
    <div className="hero-images-container">
      {/* SVG filter for real barrel / bubble distortion */}
      <svg width="0" height="0" aria-hidden="true" className="absolute">
        <defs>
          <filter id="bubble-warp" x="-5%" y="-5%" width="110%" height="110%">
            <feGaussianBlur in="SourceGraphic" stdDeviation="12" result="soft" />
            <feDisplacementMap
              in="SourceGraphic"
              in2="soft"
              scale="22"
              xChannelSelector="R"
              yChannelSelector="G"
            />
          </filter>
        </defs>
      </svg>

      {POSITIONS.map((pos, slot) => {
        const imgIdx = getImageIndex(slot);
        const img = IMAGES[imgIdx];
        const z = Z_ORDER[slot];
        const isHovered = hoveredIdx === slot;

        return (
          <div
            key={slot}
            className={`hero-circle ${isHovered ? "hero-circle-hovered" : ""}`}
            style={
              {
                "--cx": pos.x,
                "--cy": pos.y,
                "--size": pos.size,
                zIndex: z,
              } as React.CSSProperties
            }
            onMouseEnter={() => setHoveredIdx(slot)}
            onMouseLeave={() => {
              setHoveredIdx(null);
              endHold();
            }}
            onMouseDown={startHold}
            onMouseUp={endHold}
            onTouchStart={startHold}
            onTouchEnd={endHold}
          >
            <div className="hero-circle-inner">
              <Image
                src={img.src}
                alt={img.alt}
                fill
                className="hero-circle-img"
                sizes="(max-width: 768px) 40vw, 16vw"
              />
              <div className="hero-circle-gleam" />
            </div>
          </div>
        );
      })}
    </div>
  );
}
