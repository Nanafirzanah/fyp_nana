import {
  useState,
  useRef,
  useLayoutEffect,
  forwardRef,
  useImperativeHandle,
} from "react";
import { MoreVertical } from "lucide-react";

export interface ContextMenuItem {
  label: string;
  icon: React.ReactNode;
  onClick: () => void;
  danger?: boolean;
}

interface ContextMenuProps {
  items: ContextMenuItem[];
}

// Adding a function of right clicking will open the same menu of 3 dots menu
export interface ContextMenuHandle {
  openAt: (x: number, y: number) => void;
}

const MENU_PADDING = 8;

const ContextMenu = forwardRef<ContextMenuHandle, ContextMenuProps>(
  function ContextMenu({ items }, ref) {
    const [open, setOpen] = useState(false);
    const [position, setPosition] = useState<{ x: number; y: number } | null>(
      null,
    );
    const [menuSize, setMenuSize] = useState<{
      width: number;
      height: number;
    } | null>(null);
    const menuElRef = useRef<HTMLDivElement>(null);

    useImperativeHandle(ref, () => ({
      openAt: (x, y) => {
        setMenuSize(null);
        setPosition({ x, y });
        setOpen(true);
      },
    }));

    function close() {
      setOpen(false);
      setPosition(null);
      setMenuSize(null);
    }

    useLayoutEffect(() => {
      if (position && menuElRef.current) {
        const rect = menuElRef.current.getBoundingClientRect();
        setMenuSize({ width: rect.width, height: rect.height });
      }
    }, [position]);

    let cursorStyle: React.CSSProperties | undefined;
    if (position) {
      const width = menuSize?.width ?? 0;
      const height = menuSize?.height ?? 0;
      cursorStyle = {
        left: Math.min(position.x, window.innerWidth - width - MENU_PADDING),
        top: Math.min(position.y, window.innerHeight - height - MENU_PADDING),
      };
    }

    return (
      <div className="relative">
        <button
          onClick={(e) => {
            e.stopPropagation();
            setPosition(null);
            setMenuSize(null);
            setOpen((prev) => !prev);
          }}
          className="w-7 h-7 flex items-center justify-center rounded-md text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors opacity-0 group-hover:opacity-100 focus:opacity-100 focus:outline-none focus:ring-2 focus:ring-blue-300"
          aria-label="More options"
        >
          <MoreVertical size={15} aria-hidden="true" />
        </button>

        {open && (
          <>
            {/* Backdrop - sits behind the menu */}
            <div
              className="fixed inset-0 z-40"
              onClick={close}
              onContextMenu={(e) => {
                e.preventDefault();
                close();
              }}
              aria-hidden="true"
            />
            {/* Menu - anchored to button */}
            <div
              ref={menuElRef}
              className={
                position
                  ? "fixed z-50 min-w-[144px] rounded-lg border border-slate-200 bg-white shadow-lg overflow-hidden"
                  : "absolute right-0 top-8 z-50 min-w-[144px] rounded-lg border border-slate-200 bg-white shadow-lg overflow-hidden"
              }
              style={cursorStyle}
            >
              {items.map((item, index) => (
                <div key={index}>
                  {item.danger && index > 0 && (
                    <div className="h-px bg-slate-100 my-1" />
                  )}
                  <button
                    onClick={() => {
                      close();
                      item.onClick();
                    }}
                    className={`w-full flex items-center gap-2.5 px-3 py-2 text-sm text-left transition-colors ${item.danger ? "text-red-600 hover:bg-red-50" : "text-slate-700 hover:bg-slate-50"}`}
                  >
                    <span className="flex-shrink-0">{item.icon}</span>
                    {item.label}
                  </button>
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    );
  },
);

export default ContextMenu;
