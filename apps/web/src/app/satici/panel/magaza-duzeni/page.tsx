import StoreLayoutForm from "./store-layout-form";
import SlidesManager from "./slides-manager";
import SocialPostsManager from "./social-posts-manager";

export default function VendorStoreLayoutPage() {
  return (
    <div>
      <StoreLayoutForm />
      <SlidesManager />
      <SocialPostsManager />
    </div>
  );
}
