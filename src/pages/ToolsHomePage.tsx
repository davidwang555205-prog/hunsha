/**
 * ToolsHomePage -- 工具首页（V2，苹果风格）
 *
 * 登录后默认落地页。按类目展示工具卡片，点击切到该类目并进入 /studio。
 * 卡片顶部展示封面图（左右两张并排自适应），下方图标 / 名称 / 简介
 * （categories.description），悬停微动。封面图来自 category.config.coverImages
 * （admin 在 /admin/categories 上传），无封面图时回退纯图标卡。预留多类目扩展。
 */
import { useNavigate } from "react-router-dom";
import { useCategory } from "../context/CategoryContext";
import { Button } from "../components/ui/Button";
import { FadeIn } from "../components/motion/FadeIn";
import { PageHeader } from "../components/layout/PageHeader";
import { CategoryIcon } from "../components/icons";
import type { Category } from "../types/api";

export function ToolsHomePage() {
  const { categories, setCurrentCategoryId } = useCategory();
  const navigate = useNavigate();

  // 类目列表（后端 categories 表为空时兜底默认婚纱类）
  const items: Category[] =
    categories.length > 0
      ? categories
      : [
          {
            id: "default",
            name: "婚纱礼服",
            icon: "👗",
            engine: "bridal",
            description: "婚纱礼服行业小红书内容生成，覆盖试纱、客照、门店等场景。",
            sortOrder: 0,
            isEnabled: true,
            config: {},
            createdAt: "",
            updatedAt: ""
          }
        ];

  const enterCategory = (c: Category) => {
    setCurrentCategoryId(c.id);
    navigate("/studio");
  };

  return (
    <>
      <PageHeader
        title="内容创作工具"
        subtitle="选择类目，一键生成小红书图文内容。生成参数已内置，上传参考图即可开始。"
      />

      <FadeIn direction="up" duration={300}>
      <section>
        <h2 className="mb-5 text-xs font-medium uppercase tracking-[0.14em] text-text-muted">我的工具</h2>
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {items.map((c) => {
            const rawCovers = c.config?.coverImages;
            const covers: string[] = Array.isArray(rawCovers) ? (rawCovers as string[]) : [];
            const hasCovers = covers.length > 0;
            return (
              <button
                key={c.id}
                type="button"
                onClick={() => enterCategory(c)}
                className="group block w-full overflow-hidden rounded-2xl border border-border bg-surface text-left transition duration-base ease-out hover:-translate-y-1 hover:border-primary/40 hover:shadow-lg"
              >
                {/* 顶部封面图：左右两张并排自适应（有封面图时展示，无则回退纯图标卡） */}
                {hasCovers && (
                  <div className="grid grid-cols-2 gap-0.5">
                    {covers.slice(0, 2).map((url, i) => (
                      <div key={i} className="aspect-[3/4] overflow-hidden bg-bg">
                        <img src={url} alt={`${c.name} ${i + 1}`} className="h-full w-full object-cover transition duration-base ease-out group-hover:scale-105" loading="lazy" />
                      </div>
                    ))}
                  </div>
                )}
                <div className="flex flex-col p-6">
                  {/* 图标 + 类目名称同一行 */}
                  <div className="flex items-center gap-3">
                    <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary transition duration-base ease-out group-hover:bg-primary/15">
                      <CategoryIcon categoryName={c.name} engine={c.engine} size={24} />
                    </div>
                    <h3 className="text-lg font-semibold text-text">{c.name}</h3>
                  </div>
                  {/* 类目介绍 */}
                  <p className="mt-3 line-clamp-2 text-sm leading-6 text-text-muted">
                    {c.description || "小红书图文一键生成"}
                  </p>
                  {/* 底部进入创作按钮 */}
                  <Button variant="secondary" size="sm" className="mt-5 w-full">
                    进入创作
                    <span aria-hidden className="ml-1">→</span>
                  </Button>
                </div>
              </button>
            );
          })}
        </div>
      </section>
      </FadeIn>
    </>
  );
}
