import React, { useState } from 'react';
import { StyleProp, StyleSheet, TextStyle, TouchableOpacity, ViewStyle } from 'react-native';
import { Text } from './TranslatedText';
import { Typography } from '../theme';

interface ExpandableTextProps {
  text?: string | null;
  style?: StyleProp<TextStyle>;
  toggleStyle?: StyleProp<TextStyle>;
  containerStyle?: StyleProp<ViewStyle>;
  collapsedLines?: number;
  minLengthToCollapse?: number;
}

export const ExpandableText: React.FC<ExpandableTextProps> = ({
  text,
  style,
  toggleStyle,
  containerStyle,
  collapsedLines = 3,
  minLengthToCollapse = 140,
}) => {
  const [expanded, setExpanded] = useState(false);
  const content = text?.trim();

  if (!content) return null;

  const canToggle = content.length > minLengthToCollapse || content.includes('\n');

  return (
    <TouchableOpacity
      activeOpacity={canToggle ? 0.75 : 1}
      onPress={canToggle ? () => setExpanded((value) => !value) : undefined}
      style={containerStyle}
    >
      <Text
        translate={false}
        style={style}
        numberOfLines={canToggle && !expanded ? collapsedLines : undefined}
        ellipsizeMode="tail"
      >
        {content}
      </Text>
      {canToggle ? (
        <Text style={[styles.toggle, toggleStyle]}>
          {expanded ? 'Show less' : 'See more'}
        </Text>
      ) : null}
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  toggle: {
    alignSelf: 'flex-start',
    fontFamily: Typography.fontFamily.semiBold,
    fontSize: Typography.fontSize.sm,
    marginTop: 4,
  },
});
