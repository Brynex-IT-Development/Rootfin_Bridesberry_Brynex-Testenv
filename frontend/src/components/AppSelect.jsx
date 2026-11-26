import React, { useMemo } from "react";
import Select from "react-select";

/**
 * Standardized RootFin Dropdown styles matching the Day Book Category dropdown UI:
 * - White crisp control with sharp 0px corners and dark #18181b focus border
 * - Vertical separator before chevron indicator
 * - White dropdown menu with #18181b selected row (white text) and #f1f5f9 hover
 */
export const appSelectStyles = {
    control: (provided, state) => ({
        ...provided,
        backgroundColor: state.isDisabled ? "#f8fafc" : "#ffffff",
        borderColor: state.isFocused ? "#18181b" : "#e2e8f0",
        borderWidth: "1px",
        borderRadius: "0px",
        padding: "1px 2px",
        minHeight: "38px",
        boxShadow: state.isFocused ? "0 0 0 1px #18181b" : "none",
        "&:hover": {
            borderColor: state.isFocused ? "#18181b" : "#cbd5e1",
        },
        fontSize: "0.875rem",
        fontWeight: "500",
        color: "#1e293b",
        cursor: state.isDisabled ? "not-allowed" : "pointer",
    }),
    valueContainer: (provided) => ({
        ...provided,
        padding: "2px 10px",
    }),
    singleValue: (provided) => ({
        ...provided,
        color: "#1e293b",
        fontWeight: "500",
    }),
    placeholder: (provided) => ({
        ...provided,
        color: "#94a3b8",
        fontWeight: "400",
    }),
    indicatorSeparator: (provided) => ({
        ...provided,
        backgroundColor: "#cbd5e1",
        marginTop: "8px",
        marginBottom: "8px",
    }),
    dropdownIndicator: (provided) => ({
        ...provided,
        color: "#475569",
        padding: "6px 10px",
        "&:hover": {
            color: "#18181b",
        },
    }),
    option: (provided, state) => ({
        ...provided,
        backgroundColor: state.isSelected
            ? "#18181b"
            : state.isFocused
            ? "#f1f5f9"
            : "#ffffff",
        color: state.isSelected ? "#ffffff" : "#334155",
        fontSize: "0.875rem",
        fontWeight: state.isSelected ? "500" : "400",
        padding: "10px 14px",
        cursor: state.isDisabled ? "not-allowed" : "pointer",
        opacity: state.isDisabled ? 0.5 : 1,
        "&:active": {
            backgroundColor: "#18181b",
            color: "#ffffff",
        },
    }),
    menu: (provided) => ({
        ...provided,
        borderRadius: "0px",
        border: "1px solid #e2e8f0",
        boxShadow: "0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)",
        marginTop: "4px",
        zIndex: 9999,
        overflow: "hidden",
    }),
    menuPortal: (provided) => ({
        ...provided,
        zIndex: 9999,
    }),
    menuList: (provided) => ({
        ...provided,
        paddingTop: 0,
        paddingBottom: 0,
        maxHeight: "280px",
    }),
    groupHeading: (provided) => ({
        ...provided,
        fontSize: "0.75rem",
        fontWeight: "600",
        color: "#64748b",
        padding: "6px 14px",
        backgroundColor: "#f8fafc",
        marginBottom: 0,
    }),
};

const extractText = (node) => {
    if (node == null || typeof node === "boolean") return "";
    if (typeof node === "string" || typeof node === "number") return String(node);
    if (Array.isArray(node)) return node.map(extractText).join("");
    if (React.isValidElement(node)) return extractText(node.props?.children);
    return "";
};

const parseChildrenToOptions = (children) => {
    const result = [];
    React.Children.forEach(children, (child) => {
        if (!React.isValidElement(child)) return;
        if (child.type === React.Fragment) {
            result.push(...parseChildrenToOptions(child.props.children));
            return;
        }
        if (child.type === "optgroup") {
            result.push({
                label: child.props.label || "",
                options: parseChildrenToOptions(child.props.children),
            });
            return;
        }
        if (child.type === "option") {
            const label = extractText(child.props.children);
            const rawValue = child.props.value !== undefined ? child.props.value : label;
            result.push({
                value: String(rawValue),
                rawValue,
                label,
                isDisabled: Boolean(child.props.disabled),
            });
        }
    });
    return result;
};

const flattenOptions = (opts) => {
    const flat = [];
    for (const o of opts) {
        if (o && Array.isArray(o.options)) {
            flat.push(...o.options);
        } else if (o) {
            flat.push(o);
        }
    }
    return flat;
};

const extractWrapperClasses = (className = "") => {
    if (!className) return "w-full";
    const tokens = className.split(/\s+/).filter(Boolean);
    const keep = tokens.filter((t) =>
        /^(w-|min-w-|max-w-|flex-|grow|shrink|basis-|col-span-|self-|justify-self-|m-|mt-|mb-|ml-|mr-|mx-|my-|sm:w-|md:w-|lg:w-|xl:w-)/.test(t)
    );
    if (!keep.some((t) => /^(w-|sm:w-|md:w-|lg:w-|flex-1)/.test(t))) {
        keep.unshift("w-full");
    }
    return keep.join(" ");
};

/**
 * Drop-in replacement for native `<select>` using the standardized Day Book dropdown UI.
 * Supports both native `<option>` children with `(e) => ...` onChange AND `options` prop.
 */
const AppSelect = ({
    value,
    defaultValue,
    onChange,
    children,
    options: directOptions,
    disabled = false,
    required = false,
    name = "",
    id,
    placeholder,
    className = "",
    isSearchable,
    styles,
    ...rest
}) => {
    const parsedOptions = useMemo(() => {
        if (Array.isArray(directOptions)) {
            return directOptions.map((o) =>
                typeof o === "object" && o !== null
                    ? { ...o, value: String(o.value ?? ""), rawValue: o.value ?? "" }
                    : { value: String(o), rawValue: o, label: String(o) }
            );
        }
        return parseChildrenToOptions(children);
    }, [directOptions, children]);

    const flatOptions = useMemo(() => flattenOptions(parsedOptions), [parsedOptions]);

    const currentVal = value !== undefined ? value : defaultValue;
    const selectedOption = useMemo(() => {
        if (currentVal === undefined || currentVal === null) {
            return flatOptions.find((o) => o.value === "") || null;
        }
        return flatOptions.find((o) => o.value === String(currentVal)) || null;
    }, [flatOptions, currentVal]);

    const handleChange = (opt) => {
        if (!onChange) return;
        const nextVal = opt ? opt.rawValue : "";
        onChange({
            target: { value: nextVal, name, id },
            currentTarget: { value: nextVal, name, id },
        });
    };

    const wrapperClass = useMemo(() => extractWrapperClasses(className), [className]);
    const searchable = isSearchable !== undefined ? isSearchable : flatOptions.length > 15;

    const mergedStyles = useMemo(() => {
        if (!styles) return appSelectStyles;
        return { ...appSelectStyles, ...styles };
    }, [styles]);

    return (
        <div className={`relative ${wrapperClass}`}>
            <Select
                inputId={id}
                name={name}
                options={parsedOptions}
                value={selectedOption}
                onChange={handleChange}
                isDisabled={disabled}
                isSearchable={searchable}
                placeholder={placeholder || "Select..."}
                styles={mergedStyles}
                menuPortalTarget={typeof document !== "undefined" ? document.body : null}
                menuPosition="fixed"
                classNamePrefix="rf-select"
                {...rest}
            />
            {required && (
                <input
                    tabIndex={-1}
                    autoComplete="off"
                    value={currentVal ?? ""}
                    onChange={() => {}}
                    required
                    style={{
                        opacity: 0,
                        height: 0,
                        width: 0,
                        position: "absolute",
                        bottom: 0,
                        left: "50%",
                        pointerEvents: "none",
                    }}
                />
            )}
        </div>
    );
};

export default AppSelect;
