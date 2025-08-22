import React, { ComponentProps } from "react";
import { API_BASE_URL } from "src/config";

const ProfileImage: React.FC<ComponentProps<"img">> = ({ src, ...props }) => {
  if (!src) return null;

  let proxyUrl = src;

  if (typeof src === "string" && src.startsWith("http")) {
    proxyUrl = `${API_BASE_URL}/proxy-image?url=${encodeURIComponent(src)}`;
  }

  return <img src={typeof proxyUrl === "string" ? proxyUrl : undefined} alt="" {...props} />;
};

export default ProfileImage;
