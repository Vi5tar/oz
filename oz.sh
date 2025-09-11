oz() {
  local temp_file
  temp_file=$(mktemp)
  
  command oz "$@" | tee "$temp_file" | grep -v "^export"
  
  while IFS= read -r line; do
    if [[ "$line" == export* ]]; then
      eval "$line"
    fi
  done < "$temp_file"
  
  rm "$temp_file"
}
