import { useAutoAnimate } from "@formkit/auto-animate/react";
import { ErrorMessage } from "@hookform/error-message";
import { useState, useEffect } from "react";
import { Controller, useFieldArray, useForm, useFormContext } from "react-hook-form";
import type { UseFormReturn } from "react-hook-form";
import type { z } from "zod";

import { classNames } from "@calcom/lib";
import { useLocale } from "@calcom/lib/hooks/useLocale";
import {
  Label,
  Badge,
  Button,
  Dialog,
  DialogClose,
  DialogContent,
  DialogHeader,
  DialogFooter,
  Form,
  BooleanToggleGroupField,
  SelectField,
  InputField,
  Input,
  showToast,
  Switch,
} from "@calcom/ui";
import { ArrowDown, ArrowUp, X, Plus, Trash2, Info } from "@calcom/ui/components/icon";

import { Components, isValidValueProp } from "./Components";
import { fieldTypesConfigMap } from "./fieldTypes";
import type { fieldsSchema } from "./schema";

type RhfForm = {
  fields: z.infer<typeof fieldsSchema>;
};

type RhfFormFields = RhfForm["fields"];

type RhfFormField = RhfFormFields[number];

/**
 * It works with a react-hook-form only.
 * `formProp` specifies the name of the property in the react-hook-form that has the fields. This is where fields would be updated.
 */
export const FormBuilder = function FormBuilder({
  title,
  description,
  addFieldLabel,
  formProp,
  disabled,
  LockedIcon,
  dataStore,
}: {
  formProp: string;
  title: string;
  description: string;
  addFieldLabel: string;
  disabled: boolean;
  LockedIcon: false | JSX.Element;
  /**
   * A readonly dataStore that is used to lookup the options for the fields. It works in conjunction with the field.getOptionAt property which acts as the key in options
   */
  dataStore: {
    options: Record<string, { label: string; value: string; inputPlaceholder?: string }[]>;
  };
}) {
  const fieldTypes = Object.values(fieldTypesConfigMap);

  // I would have liked to give Form Builder it's own Form but nested Forms aren't something that browsers support.
  // So, this would reuse the same Form as the parent form.
  const fieldsForm = useFormContext<RhfForm>();

  const { t } = useLocale();
  const fieldForm = useForm<RhfFormField>();
  useEffect(() => {
    const fieldVariantsConfig = fieldForm.getValues("variantsConfig");
    const defaultVariantsConfig =
      fieldTypesConfigMap[fieldForm.getValues("type") as keyof typeof fieldTypesConfigMap]?.variantsConfig?.defaultValue;

    // For a user field with type `name` e.g. we need to use defaultVariantsConfig as it might not have `variantsConfig` set already.
    if (!fieldVariantsConfig && defaultVariantsConfig) {
      fieldForm.setValue("variantsConfig", defaultVariantsConfig);
    }
  }, [fieldForm]);

  const { fields, swap, remove, update, append } = useFieldArray({
    control: fieldsForm.control,
    // HACK: It allows any property name to be used for instead of `fields` property name
    name: formProp as unknown as "fields",
  });

  function OptionsField({
    label = "Options",
    value,
    // eslint-disable-next-line @typescript-eslint/no-empty-function
    onChange = () => {},
    className = "",
    readOnly = false,
  }: {
    label?: string;
    value: { label: string; value: string }[];
    onChange?: (value: { label: string; value: string }[]) => void;
    className?: string;
    readOnly?: boolean;
  }) {
    const [animationRef] = useAutoAnimate<HTMLUListElement>();
    if (!value) {
      onChange([
        {
          label: "Option 1",
          value: "Option 1",
        },
        {
          label: "Option 2",
          value: "Option 2",
        },
      ]);
    }
    return (
      <div className={className}>
        <Label>{label}</Label>
        <div className="bg-muted rounded-md p-4">
          <ul ref={animationRef}>
            {value?.map((option, index) => (
              <li key={index}>
                <div className="flex items-center">
                  <Input
                    required
                    value={option.label}
                    onChange={(e) => {
                      // Right now we use label of the option as the value of the option. It allows us to not separately lookup the optionId to know the optionValue
                      // It has the same drawback that if the label is changed, the value of the option will change. It is not a big deal for now.
                      value.splice(index, 1, {
                        label: e.target.value,
                        value: e.target.value.toLowerCase().trim(),
                      });
                      onChange(value);
                    }}
                    readOnly={readOnly}
                    placeholder={`Enter Option ${index + 1}`}
                  />
                  {value.length > 2 && !readOnly && (
                    <Button
                      type="button"
                      className="mb-2 -ml-8 hover:!bg-transparent focus:!bg-transparent focus:!outline-none focus:!ring-0"
                      size="sm"
                      color="minimal"
                      StartIcon={X}
                      onClick={() => {
                        if (!value) {
                          return;
                        }
                        const newOptions = [...value];
                        newOptions.splice(index, 1);
                        onChange(newOptions);
                      }}
                    />
                  )}
                </div>
              </li>
            ))}
          </ul>
          {!readOnly && (
            <Button
              color="minimal"
              onClick={() => {
                value.push({ label: "", value: "" });
                onChange(value);
              }}
              StartIcon={Plus}>
              Add an Option
            </Button>
          )}
        </div>
      </div>
    );
  }
  const [fieldDialog, setFieldDialog] = useState({
    isOpen: false,
    fieldIndex: -1,
  });

  const addField = () => {
    fieldForm.reset({});
    setFieldDialog({
      isOpen: true,
      fieldIndex: -1,
    });
  };

  const editField = (index: number, data: RhfFormField) => {
    fieldForm.reset(data);
    setFieldDialog({
      isOpen: true,
      fieldIndex: index,
    });
  };

  const removeField = (index: number) => {
    remove(index);
  };

  const fieldType = fieldTypesConfigMap[fieldForm.watch("type") || "text"];
  const isFieldEditMode = fieldDialog.fieldIndex !== -1;
  return (
    <div>
      <div>
        <div className="text-default text-sm font-semibold ltr:mr-1 rtl:ml-1">
          {title}
          {LockedIcon}
        </div>
        <p className="text-subtle max-w-[280px] break-words py-1 text-sm sm:max-w-[500px]">{description}</p>
        <ul className="border-default divide-subtle mt-2 divide-y rounded-md border">
          {fields.map((field, index) => {
            const options = field.options
              ? field.options
              : field.getOptionsAt
              ? dataStore.options[field.getOptionsAt as keyof typeof dataStore]
              : [];
            const numOptions = options?.length ?? 0;
            if (field.hideWhenJustOneOption && numOptions <= 1) {
              return null;
            }
            const fieldType = fieldTypesConfigMap[field.type];
            const isRequired = field.required;
            const isFieldEditableSystemButOptional = field.editable === "system-but-optional";
            const isFieldEditableSystem = field.editable === "system";
            const isUserField = !isFieldEditableSystem && !isFieldEditableSystemButOptional;

            if (!fieldType) {
              throw new Error(`Invalid field type - ${field.type}`);
            }
            const sources = field.sources || [];
            const groupedBySourceLabel = sources.reduce((groupBy, source) => {
              const item = groupBy[source.label] || [];
              if (source.type === "user" || source.type === "default") {
                return groupBy;
              }
              item.push(source);
              groupBy[source.label] = item;
              return groupBy;
            }, {} as Record<string, NonNullable<(typeof field)["sources"]>>);

            return (
              <li
                key={field.name}
                data-testid={`field-${field.name}`}
                className="hover:bg-muted group relative flex items-center  justify-between p-4 ">
                {!disabled && (
                  <>
                    {index >= 1 && (
                      <button
                        type="button"
                        className="bg-default text-muted hover:text-emphasis disabled:hover:text-muted border-default hover:border-emphasis invisible absolute -left-[12px] -mt-4 mb-4 -ml-4 hidden h-6 w-6 scale-0 items-center justify-center rounded-md border p-1 transition-all hover:shadow disabled:hover:border-inherit disabled:hover:shadow-none group-hover:visible group-hover:scale-100 sm:ml-0 sm:flex"
                        onClick={() => swap(index, index - 1)}>
                        <ArrowUp className="h-5 w-5" />
                      </button>
                    )}
                    {index < fields.length - 1 && (
                      <button
                        type="button"
                        className="bg-default text-muted hover:border-emphasis border-default hover:text-emphasis disabled:hover:text-muted invisible absolute -left-[12px] mt-8 -ml-4 hidden h-6 w-6 scale-0 items-center justify-center rounded-md border p-1 transition-all hover:shadow disabled:hover:border-inherit disabled:hover:shadow-none group-hover:visible group-hover:scale-100 sm:ml-0 sm:flex"
                        onClick={() => swap(index, index + 1)}>
                        <ArrowDown className="h-5 w-5" />
                      </button>
                    )}
                  </>
                )}

                <div>
                  <div className="flex flex-col lg:flex-row lg:items-center">
                    <div className="text-default text-sm font-semibold ltr:mr-2 rtl:ml-2">
                      <FieldLabel field={field} />
                    </div>
                    <div className="flex items-center space-x-2">
                      {field.hidden ? (
                        // Hidden field can't be required, so we don't need to show the Optional badge
                        <Badge variant="grayWithoutHover">{t("hidden")}</Badge>
                      ) : (
                        <Badge variant="grayWithoutHover">{isRequired ? t("required") : t("optional")}</Badge>
                      )}
                      {Object.entries(groupedBySourceLabel).map(([sourceLabel, sources], key) => (
                        // We don't know how to pluralize `sourceLabel` because it can be anything
                        <Badge key={key} variant="blue">
                          {sources.length} {sources.length === 1 ? sourceLabel : `${sourceLabel}s`}
                        </Badge>
                      ))}
                    </div>
                  </div>
                  <p className="text-subtle max-w-[280px] break-words pt-1 text-sm sm:max-w-[500px]">
                    {fieldType.label}
                  </p>
                </div>
                {field.editable !== "user-readonly" && !disabled && (
                  <div className="flex items-center space-x-2">
                    {!isFieldEditableSystem && !disabled && (
                      <Switch
                        data-testid="toggle-field"
                        disabled={isFieldEditableSystem}
                        checked={!field.hidden}
                        onCheckedChange={(checked) => {
                          update(index, { ...field, hidden: !checked });
                        }}
                        classNames={{ container: "p-2 hover:bg-gray-100 rounded" }}
                        tooltip={t("show_on_booking_page")}
                      />
                    )}
                    {isUserField && (
                      <Button
                        color="destructive"
                        disabled={!isUserField}
                        variant="icon"
                        onClick={() => {
                          removeField(index);
                        }}
                        StartIcon={Trash2}
                      />
                    )}
                    <Button
                      data-testid="edit-field-action"
                      color="secondary"
                      onClick={() => {
                        editField(index, field);
                      }}>
                      {t("edit")}
                    </Button>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
        {!disabled && (
          <Button
            color="minimal"
            data-testid="add-field"
            onClick={addField}
            className="mt-4"
            StartIcon={Plus}>
            {addFieldLabel}
          </Button>
        )}
      </div>
      <Dialog
        open={fieldDialog.isOpen}
        onOpenChange={(isOpen) =>
          setFieldDialog({
            isOpen,
            fieldIndex: -1,
          })
        }>
        <DialogContent enableOverflow data-testid="edit-field-dialog">
          <DialogHeader title={t("add_a_booking_question")} subtitle={t("form_builder_field_add_subtitle")} />
          <div>
            <Form
              form={fieldForm}
              handleSubmit={(data) => {
                const type = data.type || "text";
                const isNewField = fieldDialog.fieldIndex == -1;
                if (isNewField && fields.some((f) => f.name === data.name)) {
                  showToast(t("form_builder_field_already_exists"), "error");
                  return;
                }
                if (fieldDialog.fieldIndex !== -1) {
                  update(fieldDialog.fieldIndex, data);
                } else {
                  const field: RhfFormField = {
                    ...data,
                    type,
                    sources: [
                      {
                        label: "User",
                        type: "user",
                        id: "user",
                        fieldRequired: data.required,
                      },
                    ],
                  };
                  field.editable = field.editable || "user";
                  append(field);
                }
                setFieldDialog({
                  isOpen: false,
                  fieldIndex: -1,
                });
              }}>
              <SelectField
                defaultValue={fieldTypesConfigMap.text}
                id="test-field-type"
                isDisabled={
                  fieldForm.getValues("editable") === "system" ||
                  fieldForm.getValues("editable") === "system-but-optional"
                }
                onChange={(e) => {
                  const value = e?.value;
                  if (!value) {
                    return;
                  }
                  fieldForm.setValue("type", value);
                }}
                value={fieldTypesConfigMap[fieldForm.getValues("type")]}
                options={fieldTypes.filter((f) => !f.systemOnly)}
                label={t("input_type")}
                classNames={{
                  menuList: () => "min-h-[27.25rem]",
                }}
              />
              {(() => {
                const variantsConfig = fieldForm.watch("variantsConfig");
                if (!variantsConfig) {
                  return (
                    <>
                      <InputField
                        required
                        {...fieldForm.register("name")}
                        containerClassName="mt-6"
                        disabled={
                          fieldForm.getValues("editable") === "system" ||
                          fieldForm.getValues("editable") === "system-but-optional"
                        }
                        label="Identifier"
                      />
                      <InputField
                        {...fieldForm.register("label")}
                        // System fields have a defaultLabel, so there a label is not required
                        required={
                          !["system", "system-but-optional"].includes(fieldForm.getValues("editable") || "")
                        }
                        placeholder={t(fieldForm.getValues("defaultLabel") || "")}
                        containerClassName="mt-6"
                        label={t("label")}
                      />
                      {fieldType?.isTextType ? (
                        <InputField
                          {...fieldForm.register("placeholder")}
                          containerClassName="mt-6"
                          label={t("placeholder")}
                          placeholder={t(fieldForm.getValues("defaultPlaceholder") || "")}
                        />
                      ) : null}
                      {fieldType?.needsOptions && !fieldForm.getValues("getOptionsAt") ? (
                        <Controller
                          name="options"
                          render={({ field: { value, onChange } }) => {
                            return <OptionsField onChange={onChange} value={value} className="mt-6" />;
                          }}
                        />
                      ) : null}
                      <Controller
                        name="required"
                        control={fieldForm.control}
                        render={({ field: { value, onChange } }) => {
                          return (
                            <BooleanToggleGroupField
                              data-testid="field-required"
                              disabled={fieldForm.getValues("editable") === "system"}
                              value={value}
                              onValueChange={(val) => {
                                onChange(val);
                              }}
                              label={t("required")}
                            />
                          );
                        }}
                      />
                    </>
                  );
                }

                if (!fieldType.isTextType) {
                  throw new Error("Variants are currently supported only with text type");
                }

                return <VariantFields fieldForm={fieldForm} />;
              })()}

              <DialogFooter>
                <DialogClose color="secondary">{t("cancel")}</DialogClose>
                <Button data-testid="field-add-save" type="submit">
                  {isFieldEditMode ? t("save") : t("add")}
                </Button>
              </DialogFooter>
            </Form>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

// TODO: Add consistent `label` support to all the components and then remove the usage of WithLabel.
// Label should be handled by each Component itself.
const WithLabel = ({
  field,
  children,
  readOnly,
}: {
  field: Partial<RhfFormField>;
  readOnly: boolean;
  children: React.ReactNode;
}) => {
  return (
    <div>
      {/* multiemail doesnt show label initially. It is shown on clicking CTA */}
      {/* boolean type doesn't have a label overall, the radio has it's own label */}
      {/* Component itself managing it's label should remove these checks */}
      {field.type !== "boolean" && field.type !== "multiemail" && field.label && (
        <div className="mb-2 flex items-center">
          <Label className="!mb-0">
            <span>{field.label}</span>
            <span className="text-emphasis ml-1 -mb-1 text-sm font-medium leading-none">
              {!readOnly && field.required ? "*" : ""}
            </span>
          </Label>
        </div>
      )}
      {children}
    </div>
  );
};

type ValueProps =
  | {
      value: string[];
      setValue: (value: string[]) => void;
    }
  | {
      value: string;
      setValue: (value: string) => void;
    }
  | {
      value: {
        value: string;
        optionValue: string;
      };
      setValue: (value: { value: string; optionValue: string }) => void;
    }
  | {
      value: boolean;
      setValue: (value: boolean) => void;
    };

export const ComponentForField = ({
  field,
  value,
  setValue,
  readOnly,
}: {
  field: Omit<RhfFormField, "editable" | "label"> & {
    // Label is optional because radioInput doesn't have a label
    label?: string;
  };
  readOnly: boolean;
} & ValueProps) => {
  const fieldType = field.type || "text";
  const componentConfig = Components[fieldType];

  const isValueOfPropsType = (val: unknown, propsType: typeof componentConfig.propsType) => {
    const isValid = isValidValueProp[propsType](val);
    return isValid;
  };

  // If possible would have wanted `isValueOfPropsType` to narrow the type of `value` and `setValue` accordingly, but can't seem to do it.
  // So, code following this uses type assertion to tell TypeScript that everything has been validated
  if (value !== undefined && !isValueOfPropsType(value, componentConfig.propsType)) {
    throw new Error(
      `Value ${value} is not valid for type ${componentConfig.propsType} for field ${field.name}`
    );
  }
  if (componentConfig.propsType === "text") {
    return (
      <WithLabel field={field} readOnly={readOnly}>
        <componentConfig.factory
          placeholder={field.placeholder}
          name={field.name}
          label={field.label}
          readOnly={readOnly}
          value={value as string}
          setValue={setValue as (arg: typeof value) => void}
        />
      </WithLabel>
    );
  }

  if (componentConfig.propsType === "boolean") {
    return (
      <WithLabel field={field} readOnly={readOnly}>
        <componentConfig.factory
          name={field.name}
          label={field.label}
          readOnly={readOnly}
          value={value as boolean}
          setValue={setValue as (arg: typeof value) => void}
          placeholder={field.placeholder}
        />
      </WithLabel>
    );
  }

  if (componentConfig.propsType === "textList") {
    return (
      <WithLabel field={field} readOnly={readOnly}>
        <componentConfig.factory
          placeholder={field.placeholder}
          name={field.name}
          label={field.label}
          readOnly={readOnly}
          value={value as string[]}
          setValue={setValue as (arg: typeof value) => void}
        />
      </WithLabel>
    );
  }

  if (componentConfig.propsType === "select") {
    if (!field.options) {
      throw new Error("Field options is not defined");
    }

    return (
      <WithLabel field={field} readOnly={readOnly}>
        <componentConfig.factory
          readOnly={readOnly}
          value={value as string}
          name={field.name}
          placeholder={field.placeholder}
          setValue={setValue as (arg: typeof value) => void}
          options={field.options.map((o) => ({ ...o, title: o.label }))}
        />
      </WithLabel>
    );
  }

  if (componentConfig.propsType === "multiselect") {
    if (!field.options) {
      throw new Error("Field options is not defined");
    }
    return (
      <WithLabel field={field} readOnly={readOnly}>
        <componentConfig.factory
          placeholder={field.placeholder}
          name={field.name}
          readOnly={readOnly}
          value={value as string[]}
          setValue={setValue as (arg: typeof value) => void}
          options={field.options.map((o) => ({ ...o, title: o.label }))}
        />
      </WithLabel>
    );
  }

  if (componentConfig.propsType === "objectiveWithInput") {
    if (!field.options) {
      throw new Error("Field options is not defined");
    }
    if (!field.optionsInputs) {
      throw new Error("Field optionsInputs is not defined");
    }
    return field.options.length ? (
      <WithLabel field={field} readOnly={readOnly}>
        <componentConfig.factory
          placeholder={field.placeholder}
          readOnly={readOnly}
          name={field.name}
          value={value as { value: string; optionValue: string }}
          setValue={setValue as (arg: typeof value) => void}
          optionsInputs={field.optionsInputs}
          options={field.options}
          required={field.required}
        />
      </WithLabel>
    ) : null;
  }

  if (componentConfig.propsType === "variants") {
    if (!field.variantsConfig?.variants) {
      throw new Error("Field variantsConfig.variants is not defined");
    }
    return (
      <componentConfig.factory
        placeholder={field.placeholder}
        readOnly={readOnly}
        name={field.name}
        variant={field.variant}
        value={value as { value: string; optionValue: string }}
        setValue={setValue as (arg: Record<string, string> | string) => void}
        variants={field.variantsConfig.variants}
      />
    );
  }

  assertUnreachable(componentConfig);
  return null;
};

export const FormBuilderField = ({
  field,
  readOnly,
  className,
}: {
  field: RhfFormFields[number];
  readOnly: boolean;
  className: string;
}) => {
  const { t } = useLocale();
  const { control, formState } = useFormContext();
  if (field.variantsConfig?.variants) {
    Object.entries(field.variantsConfig.variants).forEach(([variantName, variant]) => {
      variant.fields.forEach((variantField) => {
        const variantsConfig = fieldTypesConfigMap[field.type]?.variantsConfig;
        const defaultVariantFieldLabel =
          variantsConfig?.variants?.[variantName]?.fieldsMap[variantField.name]?.defaultLabel;

        variantField.label = variantField.label || t(defaultVariantFieldLabel || "");
      });
    });
  }
  return (
    <div data-fob-field-name={field.name} className={classNames(className, field.hidden ? "hidden" : "")}>
      <Controller
        control={control}
        // Make it a variable
        name={`responses.${field.name}`}
        render={({ field: { value, onChange }, fieldState: { error } }) => {
          return (
            <div>
              <ComponentForField
                field={field}
                value={value}
                readOnly={readOnly}
                setValue={(val: unknown) => {
                  onChange(val);
                }}
              />
              <ErrorMessage
                name="responses"
                errors={formState.errors}
                render={({ message }: { message: string | undefined }) => {
                  message = message || "";
                  // If the error comes due to parsing the `responses` object(which can have error for any field), we need to identify the field that has the error from the message
                  const name = message.replace(/\{([^}]+)\}.*/, "$1");
                  const isResponsesErrorForThisField = name === field.name;
                  // If the error comes for the specific property of responses(Possible for system fields), then also we would go ahead and show the error
                  if (!isResponsesErrorForThisField && !error) {
                    return null;
                  }

                  message = message.replace(/\{[^}]+\}(.*)/, "$1").trim();
                  if (field.hidden) {
                    console.error(`Error message for hidden field:${field.name} => ${message}`);
                  }
                  return (
                    <div
                      data-testid={`error-message-${field.name}`}
                      className="mt-2 flex items-center text-sm text-red-700 ">
                      <Info className="h-3 w-3 ltr:mr-2 rtl:ml-2" />
                      <p>{t(message || "invalid_input")}</p>
                    </div>
                  );
                }}
              />
            </div>
          );
        }}
      />
    </div>
  );
};

function FieldLabel({ field }: { field: RhfFormField }) {
  const { t } = useLocale();
  const fieldTypeConfig = fieldTypesConfigMap[field.type];
  const fieldTypeConfigVariantsConfig = fieldTypeConfig?.variantsConfig;
  const fieldTypeConfigVariants = fieldTypeConfigVariantsConfig?.variants;
  const variantsConfig = field.variantsConfig;
  const defaultVariant = fieldTypeConfigVariantsConfig?.defaultVariant;
  if (!fieldTypeConfigVariants || !variantsConfig) {
    return <span>{field.label || t(field.defaultLabel || "")}</span>;
  }
  const variant = field.variant || defaultVariant;
  if (!variant) {
    throw new Error(
      "Field has `variantsConfig` but no `defaultVariant`" + JSON.stringify(fieldTypeConfigVariantsConfig)
    );
  }
  return <span>{t(fieldTypeConfigVariants[variant as keyof typeof fieldTypeConfigVariants].label)}</span>;
}

function VariantSelector() {
  // Implement a Variant selector for cases when there are more than 2 variants
  return null;
}

function VariantFields({ fieldForm }: { fieldForm: UseFormReturn<RhfFormField> }) {
  const { t } = useLocale();
  const variantsConfig = fieldForm.getValues("variantsConfig");
  if (!variantsConfig) {
    throw new Error("VariantFields component needs variantsConfig");
  }
  const fieldTypeConfigVariantsConfig = fieldTypesConfigMap[fieldForm.getValues("type")]?.variantsConfig;

  if (!fieldTypeConfigVariantsConfig) {
    throw new Error("Coniguration Issue: FieldType doesn't have `variantsConfig`");
  }

  const variantToggleLabel = t(fieldTypeConfigVariantsConfig.toggleLabel || "");

  const defaultVariant = fieldTypeConfigVariantsConfig.defaultVariant;

  const variantNames = Object.keys(variantsConfig.variants);
  const otherVariants = variantNames.filter((v) => v !== defaultVariant);
  if (otherVariants.length > 1 && variantToggleLabel) {
    throw new Error("More than one other variant. Remove toggleLabel ");
  }
  const otherVariant = otherVariants[0];
  const variantName = fieldForm.watch("variant") || defaultVariant;
  const variantFields = variantsConfig.variants[variantName as keyof typeof variantsConfig].fields;
  /**
   * A variant that has just one field can be shown in a simpler way in UI.
   */
  const isSimpleVariant = variantFields.length === 1;
  const isDefaultVariant = variantName === defaultVariant;
  const supportsVariantToggle = variantNames.length === 2;
  return (
    <>
      {supportsVariantToggle ? (
        <Switch
          checked={!isDefaultVariant}
          label={variantToggleLabel}
          data-testid="variant-toggle"
          onCheckedChange={(checked) => {
            fieldForm.setValue("variant", checked ? otherVariant : defaultVariant);
          }}
          classNames={{ container: "p-2 mt-2 hover:bg-gray-100 rounded" }}
          tooltip={t("Toggle Variant")}
        />
      ) : (
        <VariantSelector />
      )}

      <InputField
        required
        {...fieldForm.register("name")}
        containerClassName="mt-6"
        disabled={
          fieldForm.getValues("editable") === "system" ||
          fieldForm.getValues("editable") === "system-but-optional"
        }
        label="Identifier"
      />

      <ul
        className={classNames(
          !isSimpleVariant ? "border-default divide-subtle mt-2 divide-y rounded-md border" : ""
        )}>
        {variantFields.map((f, index) => {
          const rhfVariantFieldPrefix = `variantsConfig.variants.${variantName}.fields.${index}` as const;
          const fieldTypeConfigVariants =
            fieldTypeConfigVariantsConfig.variants[
              variantName as keyof typeof fieldTypeConfigVariantsConfig.variants
            ];
          const appUiFieldConfig =
            fieldTypeConfigVariants.fieldsMap[f.name as keyof typeof fieldTypeConfigVariants.fieldsMap];
          return (
            <li className={classNames(!isSimpleVariant ? "p-4" : "")} key={f.name}>
              {!isSimpleVariant && (
                <Label className="flex justify-between">
                  <span>{`Field ${index + 1}`}</span>
                  <span className="text-muted">{`${fieldForm.getValues("name")}.${f.name}`}</span>
                </Label>
              )}
              <InputField
                {...fieldForm.register(`${rhfVariantFieldPrefix}.label`)}
                placeholder={t(appUiFieldConfig?.defaultLabel || "")}
                containerClassName="mt-6"
                label={t("label")}
              />
              <InputField
                {...fieldForm.register(`${rhfVariantFieldPrefix}.placeholder`)}
                key={f.name}
                containerClassName="mt-6"
                label={t("placeholder")}
                placeholder={t(appUiFieldConfig?.defaultPlaceholder || "")}
              />

              <Controller
                name={`${rhfVariantFieldPrefix}.required`}
                control={fieldForm.control}
                render={({ field: { value, onChange } }) => {
                  return (
                    <BooleanToggleGroupField
                      data-testid="field-required"
                      disabled={!appUiFieldConfig?.canChangeRequirability}
                      value={value}
                      onValueChange={(val) => {
                        onChange(val);
                      }}
                      label={t("required")}
                    />
                  );
                }}
              />
            </li>
          );
        })}
      </ul>
    </>
  );
}

function assertUnreachable(arg: never) {
  throw new Error(`Don't know how to handle ${JSON.stringify(arg)}`);
}
