import * as React from 'react';
import { Slot } from '@radix-ui/react-slot';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';

/**
 * Button.
 *
 * Every variant is defined here rather than assembled from utility classes at
 * the call site, so the same action reads the same everywhere. Pass className
 * for layout only -- width, flex, margins -- never for colour, height or
 * radius.
 *
 * Choosing one:
 *
 *   default      the single main action on a screen. Solid brand teal.
 *   contrast     a strong action inside a card, where a second teal button
 *                would compete with the page's primary. Near-black.
 *   secondary    a supporting action beside the primary. Teal tint.
 *   outline      neutral actions in a toolbar. The workhorse.
 *   ghost        tertiary actions, navigation, icon buttons.
 *   destructive  irreversible actions. Solid red.
 *   destructiveGhost  inline delete on a row, where a solid red block is loud.
 *   success / warning / info   status-driven actions.
 *   accent       decorative brand emphasis. Dark text -- see the note below.
 *   link         inline text action.
 */
const buttonVariants = cva(
    [
        'inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-xl',
        'text-sm font-semibold ring-offset-background',
        'transition-[background-color,border-color,color,box-shadow,transform] duration-150',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
        'disabled:pointer-events-none disabled:opacity-50',
        'active:translate-y-px',
        '[&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0',
    ].join(' '),
    {
        variants: {
            variant: {
                default:
                    'bg-primary text-primary-foreground shadow-sm shadow-primary/25 hover:bg-primary-hover hover:shadow-md hover:shadow-primary/25',
                contrast:
                    'bg-foreground text-background shadow-sm hover:bg-foreground/90',
                secondary:
                    'bg-secondary text-secondary-foreground hover:bg-secondary/70',
                outline:
                    'border border-border bg-card text-foreground hover:border-primary/40 hover:bg-secondary/50 hover:text-secondary-foreground',
                // Hovers onto a neutral surface. It previously used --accent,
                // which is the vivid brand teal, so ghost buttons flashed solid
                // teal on hover.
                ghost:
                    'text-foreground hover:bg-accent-muted hover:text-foreground',
                destructive:
                    'bg-destructive text-destructive-foreground shadow-sm shadow-destructive/25 hover:bg-destructive/90',
                destructiveGhost:
                    'text-destructive hover:bg-destructive/10 hover:text-destructive',
                success:
                    'bg-success text-success-foreground shadow-sm shadow-success/25 hover:bg-success/90',
                warning:
                    'bg-warning text-warning-foreground shadow-sm shadow-warning/25 hover:bg-warning/90',
                info:
                    'bg-info text-info-foreground shadow-sm shadow-info/25 hover:bg-info/90',
                // --accent is the vivid brand teal and is far too light to
                // carry white text (2.4:1), so this variant pairs it with dark
                // text instead.
                accent:
                    'bg-accent text-accent-foreground shadow-sm shadow-accent/25 hover:bg-accent/90',
                link:
                    'text-primary underline-offset-4 hover:underline',
            },
            size: {
                xs:      'h-7 rounded-lg px-2.5 text-xs gap-1.5 [&_svg]:size-3.5',
                sm:      'h-9 px-3',
                default: 'h-10 px-4',
                lg:      'h-11 px-6 text-base',
                icon:    'h-10 w-10',
                'icon-sm': 'h-8 w-8 rounded-lg [&_svg]:size-3.5',
                'icon-xs': 'h-7 w-7 rounded-lg [&_svg]:size-3.5',
            },
            /** Fully rounded, for pill-shaped controls such as the header search. */
            pill: {
                true: 'rounded-full',
            },
        },
        defaultVariants: {
            variant: 'default',
            size: 'default',
        },
    },
);

export interface ButtonProps
    extends React.ButtonHTMLAttributes<HTMLButtonElement>,
        VariantProps<typeof buttonVariants> {
    asChild?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
    ({ className, variant, size, pill, asChild = false, ...props }, ref) => {
        const Comp = asChild ? Slot : 'button';
        return (
            <Comp
                className={cn(buttonVariants({ variant, size, pill, className }))}
                ref={ref}
                {...props}
            />
        );
    },
);
Button.displayName = 'Button';

export { Button, buttonVariants };
